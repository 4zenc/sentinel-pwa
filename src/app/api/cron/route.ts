import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

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
  
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data: users, error } = await supabase.from('profiles').select('*').eq('is_active', true);
  if (error || !users) return NextResponse.json({ ok: false });

  let triggeredCount = 0;

  for (const user of users) {
    const lastCheckIn = new Date(user.last_check_in).getTime();
    const deadline = lastCheckIn + (user.check_in_interval_seconds * 1000);
    
    // Check expiration (Buffer 15s)
    if (Date.now() > (deadline + 15000)) {
      
      let locationStr = "Location Unknown";
      if (user.last_latitude && user.last_longitude) {
        locationStr = `https://www.google.com/maps?q=${user.last_latitude},${user.last_longitude}`;
      }

      // SEND EMAIL (This is the only 100% reliable free PWA automation)
      if (user.email) {
          try {
            await resend.emails.send({
                from: 'Sentinel <onboarding@resend.dev>',
                to: user.email, // Sends to self so you can forward, or add guardian email in DB
                subject: '🚨 EMERGENCY: DEAD MAN SWITCH TRIGGERED',
                html: `
                  <h1>EMERGENCY ALERT</h1>
                  <p><strong>${user.full_name}</strong> failed to check in.</p>
                  <p><strong>Location:</strong> <a href="${locationStr}">Click to View on Map</a></p>
                  <p>Please contact them immediately.</p>
                `
            });
            console.log(`Email sent for ${user.full_name}`);
          } catch (e) { console.error(e); }
      }

      await supabase.from('profiles').update({ is_active: false }).eq('id', user.id);
      triggeredCount++;
    }
  }

  return NextResponse.json({ ok: true, triggered: triggeredCount });
}