/**
 * Content Safety Service
 * 
 * Implements content moderation for AI friends to ensure safe, appropriate responses.
 * Handles: vulgar/explicit content, violence, self-harm, criminal activity, medical/legal advice.
 * 
 * CRIT-1: Content safety restrictions for AI friends
 * CRIT-2: Suicide/self-harm handling with crisis resources
 * CRIT-3: Age restrictions for minors
 */

import { db } from "../db";

// ==========================================
// Types and Interfaces
// ==========================================

export interface ContentSafetyResult {
  isBlocked: boolean;
  blockReason?: string;
  crisisDetected: boolean;
  crisisResponse?: string;
  modifiedPrompt?: string;
  safetyLevel: "safe" | "warning" | "blocked" | "crisis";
  flags: string[];
}

export interface UserAgeContext {
  userId: string;
  isMinor: boolean;
  age?: number;
}

export interface SafetyCheckOptions {
  userMessage: string;
  userId?: string;
  chatId?: string;
  isMinor?: boolean;
}

// ==========================================
// Crisis Resources by Country/Region
// ==========================================

const CRISIS_RESOURCES: Record<string, { name: string; phone: string; website?: string }[]> = {
  US: [
    { name: "National Suicide Prevention Lifeline", phone: "988", website: "https://988lifeline.org" },
    { name: "Crisis Text Line", phone: "Text HOME to 741741", website: "https://www.crisistextline.org" },
  ],
  UK: [
    { name: "Samaritans", phone: "116 123", website: "https://www.samaritans.org" },
    { name: "PAPYRUS (under 35)", phone: "0800 068 4141", website: "https://www.papyrus-uk.org" },
  ],
  CA: [
    { name: "Canada Suicide Prevention Service", phone: "1-833-456-4566", website: "https://www.crisisservicescanada.ca" },
    { name: "Kids Help Phone", phone: "1-800-668-6868", website: "https://kidshelpphone.ca" },
  ],
  AU: [
    { name: "Lifeline Australia", phone: "13 11 14", website: "https://www.lifeline.org.au" },
    { name: "Beyond Blue", phone: "1300 22 4636", website: "https://www.beyondblue.org.au" },
  ],
  DEFAULT: [
    { name: "International Association for Suicide Prevention", phone: "Visit website for local resources", website: "https://www.iasp.info/resources/Crisis_Centres/" },
    { name: "Befrienders Worldwide", phone: "Visit website", website: "https://www.befrienders.org" },
  ],
};

// ==========================================
// Detection Patterns
// ==========================================

// Self-harm and suicide related patterns (CRIT-2)
const CRISIS_PATTERNS = [
  // Direct statements
  /\b(want to|going to|planning to|thinking about|considering)\s+(kill|end|hurt)\s+(myself|my life)/i,
  /\b(want to|going to|planning to)\s+die\b/i,
  /\b(suicid|self[- ]?harm|cut myself|cutting myself)/i,
  /\b(end it all|end my life|take my life|take my own life)/i,
  /\b(don'?t want to (live|be here|exist)|no reason to live)/i,
  /\b(better off (dead|without me)|everyone would be better)/i,
  /\b(goodbye|farewell).{0,30}(forever|world|everyone)/i,
  /\b(final goodbye|last message|this is the end)/i,
  // Methods - be careful not to provide methods
  /\b(how to|ways to|best way to)\s+(kill|end|hurt)\s+(myself|yourself|oneself)/i,
  /\b(painless|quick)\s+(way|method)\s+to\s+(die|end)/i,
  // Indirect indicators
  /\b(giving away|giving everything away|won'?t need (this|these|them) anymore)/i,
  /\b(no one (cares|would notice|would miss me))/i,
];

// Violence and harm to others
const VIOLENCE_PATTERNS = [
  /\b(how to|ways to|help me)\s+(kill|murder|hurt|harm|attack|assault)\s+(someone|a person|people|them|him|her)/i,
  /\b(planning|want to|going to)\s+(kill|murder|attack|hurt)\s+(someone|people|them)/i,
  /\b(make a|build a|create a)\s+(bomb|weapon|explosive)/i,
  /\b(where to (buy|get))\s+(gun|weapon|explosive)/i,
];

// Criminal activity
const CRIMINAL_PATTERNS = [
  /\b(how to|ways to|help me)\s+(steal|rob|hack|break into|forge|counterfeit)/i,
  /\b(make|cook|synthesize|produce)\s+(meth|cocaine|heroin|fentanyl|drugs)/i,
  /\b(evade|avoid|escape)\s+(police|cops|law enforcement|authorities)/i,
  /\b(launder|laundering)\s+money/i,
  /\b(identity theft|credit card fraud|wire fraud)/i,
];

// Medical advice (should not provide specific diagnoses or treatments)
const MEDICAL_PATTERNS = [
  /\b(diagnose|diagnosis|what disease|what condition)\s+(do i|does she|does he|do they)\s+have/i,
  /\b(should i|can i)\s+(take|use|stop taking)\s+(medication|medicine|pills|drugs)/i,
  /\b(dosage|how much|how many)\s+(of|should i take)/i,
  /\b(cure|treat|fix)\s+my\s+(cancer|diabetes|heart|disease)/i,
];

// Legal advice (should not provide specific legal counsel)
const LEGAL_PATTERNS = [
  /\b(am i|is it)\s+(guilty|liable|breaking the law)/i,
  /\b(sue|lawsuit|legal action)\s+(against|for)/i,
  /\b(how to|help me)\s+(get away with|avoid prosecution|beat the charges)/i,
  /\b(write|draft)\s+(my|a)\s+(will|contract|legal document)/i,
];

// Explicit/vulgar content
const EXPLICIT_PATTERNS = [
  /\b(write|create|generate|describe)\s+(porn|erotica|sexual content|nude|naked)/i,
  /\b(explicit|graphic)\s+(sexual|sex)/i,
  /\b(roleplay|rp)\s+(sex|sexual|nsfw)/i,
];

// ==========================================
// Age Calculation Utility (CRIT-3)
// ==========================================

/**
 * Calculate age from birthdate
 */
export function calculateAge(birthdate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthdate.getFullYear();
  const monthDiff = today.getMonth() - birthdate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Get user age context from database
 */
export async function getUserAgeContext(userId: string): Promise<UserAgeContext> {
  try {
    const { data: user } = await db
      .from("user")
      .select("birthdate")
      .eq("id", userId)
      .single();

    if (!user || !user.birthdate) {
      // If no birthdate, assume adult for safety
      return { userId, isMinor: false };
    }

    const age = calculateAge(new Date(user.birthdate));
    return {
      userId,
      isMinor: age < 18,
      age,
    };
  } catch (error) {
    console.error("[ContentSafety] Error fetching user age:", error);
    return { userId, isMinor: false };
  }
}

// ==========================================
// Content Checking Functions
// ==========================================

/**
 * Check if content matches any patterns in a list
 */
function matchesPatterns(content: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(content));
}

/**
 * Get matching patterns for logging
 */
function getMatchingFlags(content: string, patternSets: { name: string; patterns: RegExp[] }[]): string[] {
  const flags: string[] = [];
  for (const { name, patterns } of patternSets) {
    if (matchesPatterns(content, patterns)) {
      flags.push(name);
    }
  }
  return flags;
}

/**
 * Generate crisis response message with resources
 */
function generateCrisisResponse(region: string = "DEFAULT"): string {
  const resources = CRISIS_RESOURCES[region] || CRISIS_RESOURCES.DEFAULT;
  
  let response = `I'm really concerned about what you've shared. Your life matters, and there are people who want to help.\n\n`;
  response += `**Please reach out to one of these resources:**\n\n`;
  
  for (const resource of resources) {
    response += `• **${resource.name}**: ${resource.phone}`;
    if (resource.website) {
      response += ` (${resource.website})`;
    }
    response += `\n`;
  }
  
  response += `\nYou don't have to face this alone. These services are free, confidential, and available 24/7. ❤️`;
  
  return response;
}

// ==========================================
// Main Safety Check Function
// ==========================================

/**
 * Check user message for safety concerns
 * Returns safety result with appropriate blocking or crisis response
 */
export async function checkContentSafety(options: SafetyCheckOptions): Promise<ContentSafetyResult> {
  const { userMessage, userId, chatId, isMinor } = options;
  const normalizedMessage = userMessage.toLowerCase();
  
  const flags: string[] = [];
  let safetyLevel: ContentSafetyResult["safetyLevel"] = "safe";
  
  // Check for crisis/self-harm content (CRIT-2) - Highest priority
  if (matchesPatterns(normalizedMessage, CRISIS_PATTERNS)) {
    flags.push("crisis_self_harm");
    
    // Log crisis trigger for compliance
    console.log(`[ContentSafety] CRISIS DETECTED - chatId: ${chatId}, userId: ${userId}, timestamp: ${new Date().toISOString()}`);
    
    return {
      isBlocked: false, // Don't block - provide help instead
      crisisDetected: true,
      crisisResponse: generateCrisisResponse("US"), // Default to US resources, could be localized
      safetyLevel: "crisis",
      flags,
    };
  }
  
  // Check for violence against others
  if (matchesPatterns(normalizedMessage, VIOLENCE_PATTERNS)) {
    flags.push("violence");
    console.log(`[ContentSafety] Violence content blocked - chatId: ${chatId}, userId: ${userId}`);
    
    return {
      isBlocked: true,
      blockReason: "I can't help with anything that could harm others. Let's talk about something else! 💬",
      crisisDetected: false,
      safetyLevel: "blocked",
      flags,
    };
  }
  
  // Check for criminal activity
  if (matchesPatterns(normalizedMessage, CRIMINAL_PATTERNS)) {
    flags.push("criminal_activity");
    console.log(`[ContentSafety] Criminal content blocked - chatId: ${chatId}, userId: ${userId}`);
    
    return {
      isBlocked: true,
      blockReason: "I can't assist with anything illegal. How about we chat about something fun instead? 🎉",
      crisisDetected: false,
      safetyLevel: "blocked",
      flags,
    };
  }
  
  // Check for explicit content (especially strict for minors - CRIT-3)
  if (matchesPatterns(normalizedMessage, EXPLICIT_PATTERNS)) {
    flags.push("explicit_content");
    
    if (isMinor) {
      console.log(`[ContentSafety] Explicit content blocked for minor - chatId: ${chatId}, userId: ${userId}`);
    } else {
      console.log(`[ContentSafety] Explicit content blocked - chatId: ${chatId}, userId: ${userId}`);
    }
    
    return {
      isBlocked: true,
      blockReason: "I'm not able to help with that kind of content. Let's keep things fun and friendly! 😊",
      crisisDetected: false,
      safetyLevel: "blocked",
      flags,
    };
  }
  
  // Check for medical advice
  if (matchesPatterns(normalizedMessage, MEDICAL_PATTERNS)) {
    flags.push("medical_advice");
    
    return {
      isBlocked: true,
      blockReason: "I'm not a doctor and can't give medical advice. Please consult a healthcare professional for medical questions. 🏥",
      crisisDetected: false,
      safetyLevel: "blocked",
      flags,
    };
  }
  
  // Check for legal advice
  if (matchesPatterns(normalizedMessage, LEGAL_PATTERNS)) {
    flags.push("legal_advice");
    
    return {
      isBlocked: true,
      blockReason: "I'm not a lawyer and can't provide legal advice. For legal matters, please consult a qualified attorney. ⚖️",
      crisisDetected: false,
      safetyLevel: "blocked",
      flags,
    };
  }
  
  // Content passed all checks
  return {
    isBlocked: false,
    crisisDetected: false,
    safetyLevel: "safe",
    flags,
  };
}

// ==========================================
// System Prompt Safety Instructions
// ==========================================

/**
 * Get safety instructions to prepend to AI system prompts
 * These instructions guide the AI to refuse unsafe content
 */
export function getSafetySystemPrompt(isMinor: boolean = false): string {
  let safetyPrompt = `
# Safety Guidelines (CRITICAL - Always Follow)

You MUST follow these safety rules in ALL responses:

## Absolute Restrictions
- NEVER provide information about harming oneself or others
- NEVER give instructions for weapons, explosives, or dangerous substances
- NEVER assist with illegal activities or help evade law enforcement
- NEVER provide specific medical diagnoses, treatments, or medication dosages
- NEVER give specific legal advice or draft legal documents
- NEVER generate explicit sexual content, erotica, or pornography
- NEVER encourage or glorify violence, self-harm, or suicide

## When Sensitive Topics Arise
- If someone mentions self-harm or suicidal thoughts: Express genuine care, encourage professional help, and provide crisis hotline information (988 in the US)
- If asked about dangerous activities: Politely decline and redirect the conversation
- If asked for medical/legal advice: Recommend consulting a qualified professional

## Response Style
- Be helpful and friendly while maintaining these boundaries
- Decline gracefully without being preachy or lecturing
- Redirect to safer, positive topics when appropriate
`;

  // Additional restrictions for minors (CRIT-3)
  if (isMinor) {
    safetyPrompt += `
## Additional Guidelines (User Under 18)
- Keep all content strictly age-appropriate
- Avoid mature themes, even if not explicitly sexual
- Do not discuss alcohol, drugs, or adult-only topics in detail
- Maintain an extra level of caution with any borderline content
- Default to the safest interpretation of any ambiguous request
`;
  }

  return safetyPrompt;
}

/**
 * Get safety disclaimer for AI responses that touch on sensitive topics
 */
export function getSafetyDisclaimer(topic: string): string {
  const disclaimers: Record<string, string> = {
    medical: "\n\n*Note: I'm an AI and can't provide medical advice. Please consult a healthcare professional for medical concerns.*",
    legal: "\n\n*Note: I'm an AI and can't provide legal advice. Please consult a qualified attorney for legal matters.*",
    mental_health: "\n\n*If you're struggling, please reach out to a mental health professional or crisis helpline. You're not alone. ❤️*",
  };
  
  return disclaimers[topic] || "";
}

// ==========================================
// Output Filtering
// ==========================================

/**
 * Check AI output for safety before sending to user
 * This is a secondary check on the AI's generated response
 */
export function filterAIOutput(output: string): { filtered: string; wasModified: boolean } {
  // Check if output accidentally contains harmful content
  // This catches edge cases where the AI might bypass system prompts
  
  let filtered = output;
  let wasModified = false;
  
  // Remove any accidental method details for self-harm
  const dangerousPatterns = [
    /\b(pills?|overdose|hang|jump|cut|slash).{0,50}(kill|suicide|end|die)/gi,
    /\b(mix|combine).{0,30}(chemicals?|substances?|drugs?).{0,30}(lethal|deadly|poison)/gi,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(filtered)) {
      filtered = "I can't help with that. If you're going through a difficult time, please reach out to a crisis helpline like 988 (US). You matter. ❤️";
      wasModified = true;
      console.log("[ContentSafety] AI output filtered for dangerous content");
      break;
    }
  }
  
  return { filtered, wasModified };
}

// ==========================================
// Logging Functions
// ==========================================

/**
 * Log content safety event for compliance and review
 */
export function logSafetyEvent(
  eventType: "crisis" | "blocked" | "filtered",
  details: {
    chatId?: string;
    userId?: string;
    flags: string[];
    inputSummary?: string;
  }
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    eventType,
    ...details,
  };
  
  // In production, this would go to a dedicated logging service
  console.log(`[ContentSafety] Event: ${JSON.stringify(logEntry)}`);
}

