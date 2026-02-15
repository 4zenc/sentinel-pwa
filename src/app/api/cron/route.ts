import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'; 

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: users, error } = await supabase.from('profiles').select('*').eq('is_active', true);
  if (error || !users) return NextResponse.json({ ok: false });

  let triggeredCount = 0;

  for (const user of users) {
    const lastCheckIn = new Date(user.last_check_in).getTime();
    const deadline = lastCheckIn + (user.check_in_interval_seconds * 1000);
    
    // Check expiration (with 15s buffer)
    if (Date.now() > (deadline + 15000)) {
      
      // GENERATE MAP LINK
      let locationStr = "Location unknown";
      if (user.last_latitude && user.last_longitude) {
        locationStr = `https://www.google.com/maps?q=${user.last_latitude},${user.last_longitude}`;
      }

      const alertText = `🚨 *EMERGENCY ALERT*\n\n${user.full_name || 'A user'} failed to check in!\n\n*Msg:* "${user.sos_message}"\n\n*Location:* ${locationStr}`;
      const encodedMsg = encodeURIComponent(alertText);

      // LOOP THROUGH GUARDIANS
      if (user.guardians && Array.isArray(user.guardians)) {
        for (const guardian of user.guardians) {
            if (guardian.phone && guardian.apikey) {
                try {
                    const indiaNumber = `91${guardian.phone}`;
                    const url = `https://api.callmebot.com/whatsapp.php?phone=${indiaNumber}&text=${encodedMsg}&apikey=${guardian.apikey}`;
                    await fetch(url);
                    console.log(`Sent to ${guardian.name}`);
                } catch(e) { console.error(e); }
            }
        }
      }

      await supabase.from('profiles').update({ is_active: false }).eq('id', user.id);
      triggeredCount++;
    }
  }

  return NextResponse.json({ ok: true, triggered: triggeredCount });
}