'use client'
import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Heart, Settings, MapPin, Plus, Trash2, User, PhoneCall, Play, Square, X, Laptop, Smartphone, AlertTriangle, MessageCircle } from 'lucide-react'

// --- 1. INITIALIZE DB ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// --- 2. TYPES ---
type Guardian = {
  id: string;
  name: string;
  phone: string;
  apikey: string;
}

// --- 3. HELPER COMPONENTS (Moved Outside for Stability) ---
const WheelColumn = ({ items, selected, onSelect, label }: any) => {
  return (
    <div className="flex flex-col items-center relative z-10 h-full justify-center">
      <div className="h-40 w-24 overflow-y-scroll snap-y snap-mandatory hide-scrollbar">
        <div className="h-[calc(50%-2rem)]"></div>
        {items.map((i: number) => (
            <div key={i} onClick={() => onSelect(i)} 
                className={`h-16 flex items-center justify-center snap-center cursor-pointer transition-all duration-200 
                ${selected === i ? 'text-5xl font-black text-rose-600' : 'text-gray-300 text-3xl font-bold opacity-30 scale-75'}`}>
              {i}
            </div>
        ))}
        <div className="h-[calc(50%-2rem)]"></div>
      </div>
      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{label}</span>
    </div>
  )
}

const ScreenWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-gray-900 flex items-center justify-center p-0 md:p-4 font-sans">
    <div className="w-full max-w-[420px] bg-[#FFF5F7] min-h-screen md:min-h-[850px] md:rounded-[3rem] shadow-2xl relative overflow-y-auto hide-scrollbar border-[6px] border-gray-900 flex flex-col">
      {children}
    </div>
  </div>
)

// --- 4. MAIN APP COMPONENT ---
export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  
  // DATA STATES
  const [profile, setProfile] = useState<any>(null)
  const [guardians, setGuardians] = useState<Guardian[]>([])
  
  // LOCAL UI STATES
  const [localName, setLocalName] = useState('') 
  const [isMobile, setIsMobile] = useState(false)
  
  const [timeLeft, setTimeLeft] = useState<string>('00:00')
  const [view, setView] = useState('dashboard') 
  
  // WHEEL STATES
  const [selectedMin, setSelectedMin] = useState(5)
  const [selectedSec, setSelectedSec] = useState(0)

  // NEW GUARDIAN INPUTS
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newKey, setNewKey] = useState('')

  // --- DETECT DEVICE & AUTH ---
  useEffect(() => {
    const userAgent = typeof window.navigator === "undefined" ? "" : navigator.userAgent;
    const mobile = Boolean(userAgent.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i));
    setIsMobile(mobile);

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

  // --- TIMER LOGIC ---
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

  // --- ACTIONS ---
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
      setLocalName('')
      setView('settings') 
    } else {
      setProfile(data)
      setLocalName(data.full_name || '')
      if (data.check_in_interval_seconds) {
        setSelectedMin(Math.floor(data.check_in_interval_seconds / 60))
        setSelectedSec(data.check_in_interval_seconds % 60)
      }
      if (data.guardians) setGuardians(data.guardians)
    }
  }

  async function saveSettings() {
    let totalSeconds = (selectedMin * 60) + selectedSec
    if (totalSeconds < 10) totalSeconds = 10
    if (totalSeconds > 3600) totalSeconds = 3600

    const { error } = await supabase.from('profiles').update({
      full_name: localName,
      check_in_interval_seconds: totalSeconds,
      guardians: guardians
    }).eq('id', session.user.id)
    
    if (error) alert("Error saving")
    else {
      setProfile({...profile, full_name: localName, check_in_interval_seconds: totalSeconds})
      alert("Configuration Saved!")
      setView('dashboard')
    }
  }

  function addGuardian() {
    if (!newName || !newPhone || !newKey) {
      alert("Please fill all details"); return;
    }
    const updated = [...guardians, { id: Date.now().toString(), name: newName, phone: newPhone, apikey: newKey }]
    setGuardians(updated)
    setNewName('')
    setNewPhone('')
    setNewKey('')
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

  async function testBot(phone: string, apikey: string) {
     const url = `https://api.callmebot.com/whatsapp.php?phone=91${phone}&text=${encodeURIComponent("Test Message from Sakhi")}&apikey=${apikey}`;
     try {
        await fetch(url);
        alert("Test Message Sent! Check WhatsApp.");
     } catch(e) {
        alert("Failed. Check API Key.");
     }
  }

  // --- RENDER ---
  if (!session) {
    return (
      <ScreenWrapper>
        <div className="flex flex-col items-center justify-center h-full p-8 bg-gradient-to-b from-rose-50 to-white">
          <Heart className="w-16 h-16 text-rose-500 fill-rose-500 mb-6 animate-pulse" />
          <h1 className="text-4xl font-black text-gray-800 mb-2 tracking-tight">Sakhi</h1>
          <p className="text-gray-500 text-center mb-10 font-medium">Your Silent Guardian.</p>
          
          <button onClick={handleGoogleLogin} className="w-full bg-white border-2 border-gray-200 text-gray-700 font-bold p-5 rounded-2xl mb-4 flex items-center justify-center gap-3 hover:bg-gray-50 transition-all text-lg shadow-sm">
            Continue with Google
          </button>
          
          <div className="w-full flex items-center gap-3 mb-4"><div className="h-px bg-gray-300 flex-1"></div><span className="text-xs text-gray-400 font-bold">OR</span><div className="h-px bg-gray-300 flex-1"></div></div>
          
          <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white border-2 border-gray-200 p-5 rounded-2xl mb-4 text-lg font-medium outline-none focus:border-rose-400" />
          <button onClick={handleLogin} disabled={loading} className="w-full bg-rose-600 text-white font-bold p-5 rounded-2xl shadow-xl shadow-rose-200 text-lg">
            {loading ? 'Sending...' : 'Send Magic Link'}
          </button>
        </div>
      </ScreenWrapper>
    )
  }

  return (
    <ScreenWrapper>
      {/* HEADER */}
      <div className="flex justify-between items-center p-6 bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-gray-100">
        <div className="flex items-center gap-2">
           <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
           <span className="font-black text-2xl text-gray-800 tracking-tight">Sakhi</span>
        </div>
        <div className="flex gap-2">
            {/* Device Indicator */}
            <div className="p-2 bg-gray-100 rounded-full text-gray-400">
                {isMobile ? <Smartphone size={20} /> : <Laptop size={20} />}
            </div>
            <button onClick={() => setView(view === 'settings' ? 'dashboard' : 'settings')} className="p-2 bg-white rounded-full shadow-sm border border-gray-100">
            {view === 'settings' ? <X size={24} className="text-gray-600"/> : <Settings size={24} className="text-gray-600" />}
            </button>
        </div>
      </div>

      <div className="p-6 flex-grow flex flex-col">
        {view === 'dashboard' ? (
          <>
             {/* TIMER */}
             <div className="text-center mt-6 mb-8">
               <h1 className="text-[4rem] font-black text-gray-800 tracking-tighter leading-none">{timeLeft}</h1>
               <div className={`inline-flex items-center gap-2 px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] mt-2 ${profile?.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                 <div className={`w-2 h-2 rounded-full ${profile?.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                 {profile?.is_active ? 'Armed' : 'Offline'}
               </div>
             </div>

             {/* MAIN BUTTON */}
             <div className="flex-grow flex items-center justify-center relative">
               {profile?.is_active ? (
                 <button onClick={activateSwitch} className="relative w-64 h-64 rounded-full bg-gradient-to-b from-rose-500 to-rose-700 shadow-[0_10px_40px_rgba(244,63,94,0.6)] flex flex-col items-center justify-center text-white active:scale-95 transition-all">
                   <div className="absolute inset-0 rounded-full border-[6px] border-white/20 animate-pulse"></div>
                   <MapPin size={48} className="mb-2" />
                   <span className="text-2xl font-black">I AM SAFE</span>
                   <span className="text-xs font-bold opacity-80 mt-1 uppercase tracking-wide">Tap to Reset</span>
                 </button>
               ) : (
                 <button onClick={activateSwitch} className="w-64 h-64 rounded-full bg-white border-[8px] border-gray-100 shadow-xl flex flex-col items-center justify-center text-gray-400 active:scale-95 transition-all hover:border-rose-200 group">
                   <Play size={56} className="mb-2 text-gray-300 ml-2 group-hover:text-rose-400 transition-colors" />
                   <span className="text-xl font-bold text-gray-400 group-hover:text-rose-500 transition-colors">ACTIVATE</span>
                 </button>
               )}
             </div>

             {/* ACTION BUTTONS (Device Aware) */}
             <div className="mt-8 mb-4">
               {guardians.length > 0 ? (
                 <div className="grid grid-cols-2 gap-4">
                    {/* BUTTON 1: CALL */}
                    {isMobile ? (
                        <a href={`tel:${guardians[0].phone}`} className="bg-green-500 text-white p-4 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-green-200 hover:bg-green-600 transition-colors">
                            <PhoneCall size={20} /> Call
                        </a>
                    ) : (
                        <div className="bg-gray-100 text-gray-400 p-4 rounded-2xl flex items-center justify-center gap-2 font-bold cursor-not-allowed" title="Calling available on Mobile only">
                            <Laptop size={20} /> Call (PC)
                        </div>
                    )}

                    {/* BUTTON 2: WHATSAPP */}
                    <a href={`https://wa.me/91${guardians[0].phone}?text=Please%20Call%20Me`} target="_blank" className="bg-green-100 text-green-700 p-4 rounded-2xl flex items-center justify-center gap-2 font-bold border border-green-200">
                        <MessageCircle size={20} /> Msg
                    </a>
                 </div>
               ) : (
                  <div className="bg-amber-50 text-amber-600 p-4 rounded-2xl text-center text-sm font-bold border border-amber-100">
                     ⚠ Add Guardians in Settings to enable Call/Msg features.
                  </div>
               )}

               {profile?.is_active && (
                 <button onClick={stopSwitch} className="w-full mt-4 bg-gray-200 text-gray-600 p-4 rounded-2xl flex items-center justify-center gap-2 font-bold">
                   <Square size={16} fill="currentColor"/> Stop Protection
                 </button>
               )}
             </div>
          </>
        ) : (
          /* SETTINGS VIEW */
          <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500 pb-10">
            <h2 className="text-3xl font-black text-gray-800">Configuration</h2>

            {/* NAME INPUT (Fixes Typing Issue) */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                <User size={14}/> Your Name
              </label>
              <input 
                type="text" 
                value={localName} 
                onChange={(e) => setLocalName(e.target.value)} // UPDATES LOCAL STATE ONLY
                className="w-full text-2xl font-bold text-gray-800 outline-none placeholder-gray-300 border-b-2 border-transparent focus:border-rose-400 transition-colors py-2" 
                placeholder="Enter Name"
              />
            </div>

            {/* TIMER WHEEL */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
              <label className="text-xs font-bold text-gray-400 uppercase mb-6 block text-center tracking-widest">Check-in Timer</label>
              <div className="relative h-48 flex justify-center items-center gap-4">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-16 bg-rose-50 rounded-xl border border-rose-100 pointer-events-none z-0"></div>
                <WheelColumn items={Array.from({length: 61}, (_, i) => i)} selected={selectedMin} onSelect={setSelectedMin} label="Min" />
                <span className="text-gray-300 font-black text-4xl pb-6 z-10">:</span>
                <WheelColumn items={Array.from({length: 60}, (_, i) => i)} selected={selectedSec} onSelect={setSelectedSec} label="Sec" />
              </div>
            </div>

            {/* GUARDIANS MANAGER */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg text-gray-800">Guardians</h3>
                <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-1 rounded-full font-bold">{guardians.length} Active</span>
              </div>

              {/* LIST */}
              <div className="space-y-3 mb-6">
                {guardians.map((g, idx) => (
                  <div key={idx} className="bg-gray-50 p-4 rounded-2xl">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="font-bold text-gray-800">{g.name}</div>
                            <div className="text-xs text-gray-500 font-mono mt-1">+91 {g.phone}</div>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => testBot(g.phone, g.apikey)} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold">Test Bot</button>
                             <button onClick={() => removeGuardian(g.id)} className="text-rose-300 hover:text-rose-500"><Trash2 size={18}/></button>
                        </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ADD NEW */}
              <div className="bg-gray-50 p-4 rounded-2xl space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase">Add New Contact</label>
                <input type="text" placeholder="Name (e.g. Papa)" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-white p-3 rounded-xl text-sm font-bold outline-none"/>
                
                <div className="flex items-center gap-2 bg-white p-3 rounded-xl">
                  <span className="text-gray-400 text-sm font-bold">+91</span>
                  <input type="tel" placeholder="9876543210" value={newPhone} onChange={e => setNewPhone(e.target.value.replace(/\D/g,''))} className="w-full text-sm font-bold outline-none"/>
                </div>
                {/* Balance Warning */}
                <div className="flex gap-2 items-start bg-amber-50 p-2 rounded-lg">
                    <AlertTriangle size={14} className="text-amber-500 mt-1 flex-shrink-0" />
                    <p className="text-[10px] text-amber-700 leading-tight">
                        <strong>Important:</strong> Ensure this phone has an active plan and balance. Web apps cannot check SIM balance automatically.
                    </p>
                </div>

                <input type="text" placeholder="Bot API Key (From CallMeBot)" value={newKey} onChange={e => setNewKey(e.target.value)} className="w-full bg-white p-3 rounded-xl text-sm font-bold outline-none"/>
                
                <button onClick={addGuardian} className="w-full bg-gray-900 text-white text-sm font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg">
                  <Plus size={16}/> Save Contact
                </button>
              </div>
            </div>

            <button onClick={saveSettings} className="w-full bg-rose-600 text-white font-bold py-5 rounded-2xl shadow-xl shadow-rose-200 text-lg">
              Save Configuration
            </button>
          </div>
        )}
      </div>
    </ScreenWrapper>
  )
}