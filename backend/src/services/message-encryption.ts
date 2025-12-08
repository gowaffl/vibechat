import { db } from "../db";

/**
 * Message Encryption Service
 * Handles decryption of message content that was encrypted at rest
 * 
 * Encryption happens automatically via database trigger on INSERT.
 * Decryption must be done when reading messages to display to users.
 */

interface MessageWithEncryption {
  id: string;
  content: string;
  is_encrypted?: boolean;
  [key: string]: any;
}

/**
 * Decrypt a single message's content if it's encrypted
 * @param message The message object with potential encrypted content
 * @returns Message with decrypted content
 */
export async function decryptMessageContent<T extends MessageWithEncryption>(
  message: T
): Promise<T> {
  // If not encrypted or no content, return as-is
  if (!message.is_encrypted || !message.content) {
    return message;
  }

  try {
    // Call the database function to decrypt
    const { data, error } = await db.rpc('decrypt_message_content', {
      encrypted_text: message.content
    });

    if (error) {
      console.error('[MessageEncryption] Decryption error:', error);
      // Return original on error (might be legacy unencrypted data)
      return message;
    }

    return {
      ...message,
      content: data || message.content,
    };
  } catch (error) {
    console.error('[MessageEncryption] Decryption failed:', error);
    return message;
  }
}

/**
 * Decrypt multiple messages' content in batch
 * More efficient than calling decryptMessageContent for each message
 * @param messages Array of messages with potential encrypted content
 * @returns Messages with decrypted content
 */
export async function decryptMessages<T extends MessageWithEncryption>(
  messages: T[]
): Promise<T[]> {
  if (!messages || messages.length === 0) {
    return messages;
  }

  // Separate encrypted and non-encrypted messages
  const encryptedMessages = messages.filter(m => m.is_encrypted && m.content);
  const nonEncryptedMessages = messages.filter(m => !m.is_encrypted || !m.content);

  if (encryptedMessages.length === 0) {
    return messages;
  }

  // Decrypt all encrypted messages in parallel
  const decryptionPromises = encryptedMessages.map(async (msg) => {
    try {
      const { data, error } = await db.rpc('decrypt_message_content', {
        encrypted_text: msg.content
      });

      if (error) {
        console.error(`[MessageEncryption] Decryption error for message ${msg.id}:`, error);
        return msg;
      }

      return {
        ...msg,
        content: data || msg.content,
      };
    } catch (error) {
      console.error(`[MessageEncryption] Decryption failed for message ${msg.id}:`, error);
      return msg;
    }
  });

  const decryptedMessages = await Promise.all(decryptionPromises);

  // Merge back and maintain original order
  const decryptedMap = new Map(decryptedMessages.map(m => [m.id, m]));
  
  return messages.map(msg => 
    decryptedMap.has(msg.id) ? decryptedMap.get(msg.id)! : msg
  );
}

/**
 * Check if message encryption is enabled
 * This queries the vault to see if the encryption key exists
 */
export async function isEncryptionEnabled(): Promise<boolean> {
  try {
    const { data, error } = await db
      .from('vault.decrypted_secrets')
      .select('id')
      .eq('name', 'message_encryption_key')
      .maybeSingle();

    return !error && !!data;
  } catch {
    return false;
  }
}

