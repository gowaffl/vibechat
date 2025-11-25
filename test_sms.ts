
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSms() {
  const phone = "+12396998960"; // The number from your logs/examples
  console.log(`Attempting to send SMS to ${phone}...`);

  const { data, error } = await supabase.auth.signInWithOtp({
    phone,
  });

  if (error) {
    console.error("Error sending SMS:", error);
  } else {
    console.log("SMS sent successfully!", data);
  }
}

testSms();

