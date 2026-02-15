'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Heart, Settings, MapPin, Plus, Trash2, User, AlertTriangle, Play, Square } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Guardian = {
  id: string;
  name: string;
  phone: string;
  apikey: string;
}

export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [profile, setProfile] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState<string>('00:00')
  const [view, setView] = useState('dashboard') 
  
  // Wheel State
  const [selectedMin, setSelectedMin] = useState(5)
  const [selectedSec, setSelectedSec] = useState(0)

  // Guardians State
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [newGuardian, setNewGuardian] = useState<Guardian>({ id: '', name: '', phone: '', apikey: '' })

  // --- 1. AUTH & DATA ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id, session.user.email)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id, session.user.email)
    })
    return () => subscription.unsubscribe()
  }, [])

  // --- 2. TIMER LOGIC ---
  useEffect(() => {
    if (!profile?.last_check_in || !profile?.check_in_interval_seconds || !profile?.is_active) return
    
    const interval = setInterval(() => {
      const last = new Date(profile.last_check_in).getTime()
      const deadline = last + (profile.check_in_interval_seconds * 1000)
      const diff = deadline - new Date().getTime()

      if (diff < 0) setTimeLeft("ALARM SENT")
      else {
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const s = Math.floor((diff % (1000 * 60)) / 1000)
        setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [profile])

  // --- 3. ACTIONS ---
  async function handleLogin(e: any) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    if (error) alert(error.message)
    else alert('💌 OTP sent to email!')
    setLoading(false)
  }

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({ 
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
  }

  async function fetchProfile(userId: string, userEmail: string | undefined) {
    let { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (!data) {
      const newProfile = { id: userId, email: userEmail, full_name: '', guardians: [] }
      await supabase.from('profiles').insert(newProfile)
      setProfile(newProfile)
      setView('settings') // Force them to set name
    } else {
      setProfile(data)
      // Set Wheel
      if (data.check_in_interval_seconds) {
        setSelectedMin(Math.floor(data.check_in_interval_seconds / 60))
        setSelectedSec(data.check_in_interval_seconds % 60)
      }
      // Set Guardians
      if (data.guardians) setGuardians(data.guardians)
    }
  }

  async function saveSettings() {
    let totalSeconds = (selectedMin * 60) + selectedSec
    if (totalSeconds < 10) totalSeconds = 10
    if (totalSeconds > 3600) totalSeconds = 3600

    // Save to DB
    const { error } = await supabase.from('profiles').update({
      full_name: profile.full_name,
      check_in_interval_seconds: totalSeconds,
      sos_message: profile.sos_message,
      guardians: guardians // Save the array
    }).eq('id', session.user.id)
    
    if (error) alert("Error saving")
    else {
      setProfile({...profile, check_in_interval_seconds: totalSeconds})
      alert("Configuration Saved!")
      setView('dashboard')
    }
  }

  // Guardian Management
  function addGuardian() {
    if (!newGuardian.name || !newGuardian.phone || !newGuardian.apikey) {
      alert("Please fill all guardian details"); return;
    }
    const updated = [...guardians, { ...newGuardian, id: Date.now().toString() }]
    setGuardians(updated)
    setNewGuardian({ id: '', name: '', phone: '', apikey: '' })
  }

  function removeGuardian(id: string) {
    setGuardians(guardians.filter(g => g.id !== id))
  }

  async function activateSwitch() {
    if (!navigator.geolocation) { alert("Location required"); return; }
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      const updates = { last_check_in: new Date().toISOString(), is_active: true, last_latitude: latitude, last_longitude: longitude }
      await supabase.from('profiles').update(updates).eq('id', session.user.id)
      setProfile({ ...profile, ...updates })
    }, () => alert("Allow location access to start."))
  }

  async function stopSwitch() {
    await supabase.from('profiles').update({ is_active: false }).eq('id', session.user.id)
    setProfile({ ...profile, is_active: false })
  }

  // --- UI COMPONENTS ---
  const WheelColumn = ({ items, selected, onSelect, label }: any) => (
    <div className="flex flex-col items-center">
      <div className="h-32 w-16 overflow-y-scroll snap-y snap-mandatory hide-scrollbar relative py-[4rem]">
        {items.map((i: number) => (
           <div key={i} onClick={() => onSelect(i)} 
                className={`h-10 flex items-center justify-center snap-center cursor-pointer transition-all duration-200 
                ${selected === i ? 'text-2xl font-bold text-rose-600 scale-125' : 'text-gray-300 text-lg'}`}>
             {i}
           </div>
        ))}
      </div>
      <span className="text-xs text-gray-400 font-bold uppercase mt-2">{label}</span>
    </div>
  )

  const ScreenWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-0 md:p-4 font-sans">
      <div className="w-full max-w-[420px] bg-[#FFF0F5] min-h-screen md:min-h-[800px] md:h-[85vh] md:rounded-[2.5rem] shadow-2xl relative overflow-y-auto hide-scrollbar border-4 border-gray-900 flex flex-col">
        {children}
      </div>
    </div>
  )

  if (!session) {
    return (
      <ScreenWrapper>
        <div className="flex flex-col items-center justify-center h-full p-8">
          <Heart className="w-14 h-14 text-rose-500 fill-rose-500 mb-4 animate-pulse" />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Sakhi</h1>
          <p className="text-gray-500 text-center mb-8">Your silent guardian.</p>
          
          <button onClick={handleGoogleLogin} className="w-full bg-white border border-gray-300 text-gray-700 font-bold p-4 rounded-xl mb-4 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2 6.5 2 12s4.42 10 10 10c5.05 0 9.14-3.47 9.14-9.17 0-1.35-.15-2.5-.2-2.73z"/></svg>
            Continue with Google
          </button>
          
          <div className="w-full flex items-center gap-2 mb-4"><div className="h-px bg-gray-300 flex-1"></div><span className="text-xs text-gray-400">OR EMAIL</span><div className="h-px bg-gray-300 flex-1"></div></div>
          
          <input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white border border-gray-200 p-4 rounded-xl mb-4 text-lg" />
          <button onClick={handleLogin} disabled={loading} className="w-full bg-rose-500 text-white font-bold p-4 rounded-xl shadow-lg shadow-rose-200">
            {loading ? 'Sending...' : 'Send Magic Link'}
          </button>
        </div>
      </ScreenWrapper>
    )
  }

  return (
    <ScreenWrapper>
      {/* HEADER */}
      <div className="flex justify-between items-center p-6 bg-white/60 backdrop-blur-md sticky top-0 z-20">
        <span className="font-bold text-xl text-rose-600">Sakhi</span>
        <button onClick={() => setView(view === 'settings' ? 'dashboard' : 'settings')} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50">
          <Settings size={22} className="text-gray-600" />
        </button>
      </div>

      <div className="p-6 flex-grow flex flex-col">
        {view === 'dashboard' ? (
          <>
             <div className="text-center mt-2 mb-6">
               <h1 className="text-4xl font-black text-gray-800 tracking-tight">{timeLeft}</h1>
               <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
                 {profile?.is_active ? 'Status: Armored' : 'Status: Offline'}
               </p>
             </div>

             <div className="flex-grow flex items-center justify-center">
               {profile?.is_active ? (
                 <button onClick={activateSwitch} className="relative w-72 h-72 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 shadow-[0_0_60px_rgba(244,63,94,0.5)] flex flex-col items-center justify-center text-white active:scale-95 transition-all">
                   <div className="absolute inset-0 rounded-full border-4 border-white/20 animate-ping"></div>
                   <MapPin size={56} className="mb-2" />
                   <span className="text-3xl font-bold">I AM SAFE</span>
                   <span className="text-sm opacity-80 mt-1">Tap to reset timer</span>
                 </button>
               ) : (
                 <button onClick={activateSwitch} className="w-72 h-72 rounded-full bg-white border-[10px] border-rose-50 shadow-xl flex flex-col items-center justify-center text-gray-400 active:scale-95 transition-all hover:border-rose-100">
                   <Play size={64} className="mb-2 text-rose-300 ml-3" />
                   <span className="text-2xl font-bold text-gray-500">START</span>
                 </button>
               )}
             </div>

             {profile?.is_active && (
               <button onClick={stopSwitch} className="mt-8 mb-4 text-gray-400 text-sm font-semibold flex items-center justify-center gap-2 hover:text-gray-600">
                 <Square size={12} fill="currentColor"/> STOP PROTECTION
               </button>
             )}
          </>
        ) : (
          /* SETTINGS VIEW */
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-bold text-gray-800">My Profile</h2>

            {/* NAME INPUT */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-rose-50">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase mb-2">
                <User size={14}/> My Full Name
              </label>
              <input type="text" value={profile?.full_name || ''} onChange={(e) => setProfile({...profile, full_name: e.target.value})} 
                     className="w-full text-xl font-bold text-gray-800 outline-none placeholder-gray-300" placeholder="Enter your name"/>
            </div>

            {/* WHEEL PICKER */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-rose-50 relative">
              <label className="text-xs font-bold text-gray-400 uppercase mb-4 block text-center">Check-in Interval</label>
              
              <div className="relative h-32 flex justify-center items-center gap-2">
                {/* The Red Highlight Box */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-12 bg-rose-50 rounded-lg border border-rose-100 pointer-events-none z-0"></div>
                
                <WheelColumn items={Array.from({length: 61}, (_, i) => i)} selected={selectedMin} onSelect={setSelectedMin} label="Min" />
                <span className="text-gray-300 font-bold text-2xl pb-6">:</span>
                <WheelColumn items={Array.from({length: 60}, (_, i) => i)} selected={selectedSec} onSelect={setSelectedSec} label="Sec" />
              </div>
              <p className="text-center text-[10px] text-gray-400 mt-2">Timer resets to this value when you tap "I AM SAFE"</p>
            </div>

            {/* MULTI GUARDIAN LIST */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-rose-50">
              <div className="flex items-center gap-2 mb-4 text-rose-600">
                <AlertTriangle size={18} />
                <h3 className="font-bold">Emergency Guardians</h3>
              </div>

              {/* List Existing */}
              <div className="space-y-3 mb-4">
                {guardians.map((g, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                    <div>
                      <div className="font-bold text-sm text-gray-700">{g.name}</div>
                      <div className="text-xs text-gray-400">+91 {g.phone}</div>
                    </div>
                    <button onClick={() => removeGuardian(g.id)} className="text-red-400 p-2"><Trash2 size={16}/></button>
                  </div>
                ))}
                {guardians.length === 0 && <p className="text-xs text-gray-400 text-center italic">No guardians added yet.</p>}
              </div>

              {/* Add New */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <input type="text" placeholder="Mom / Dad" value={newGuardian.name} onChange={e => setNewGuardian({...newGuardian, name: e.target.value})} className="w-full bg-gray-50 p-3 rounded-lg text-sm outline-none"/>
                <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                  <span className="text-gray-400 text-sm font-bold">+91</span>
                  <input type="tel" placeholder="9876543210" value={newGuardian.phone} onChange={e => setNewGuardian({...newGuardian, phone: e.target.value.replace(/\D/g,'')})} className="w-full bg-transparent text-sm outline-none"/>
                </div>
                <input type="text" placeholder="Bot API Key (Ask Guardian)" value={newGuardian.apikey} onChange={e => setNewGuardian({...newGuardian, apikey: e.target.value})} className="w-full bg-gray-50 p-3 rounded-lg text-sm outline-none"/>
                
                <button onClick={addGuardian} className="w-full bg-gray-900 text-white text-sm font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                  <Plus size={16}/> Add Guardian
                </button>
              </div>
              
              <div className="mt-4 text-[10px] text-gray-400 bg-blue-50 p-2 rounded text-center">
                Guardians must WhatsApp <strong>"I allow callmebot"</strong> to <strong>+34 621 07 33 29</strong> to get their API Key.
              </div>
            </div>

            <button onClick={saveSettings} className="w-full bg-rose-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-rose-200 mb-8">
              Save Configuration
            </button>
          </div>
        )}
      </div>
    </ScreenWrapper>
  )
}