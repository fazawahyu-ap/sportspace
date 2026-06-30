import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, setDoc, getDoc, arrayUnion, query, where, getDocs } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from './firebaseConfig';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

// --- GENERATOR 15 AVATAR KARAKTER ILUSTRASI ---
const AVATARS = Array.from({ length: 15 }, (_, i) => `https://api.dicebear.com/7.x/adventurer/svg?seed=SportSpacePemain${i + 1}&backgroundColor=f1f5f9,e0f2fe,dcfce7,ffedd5,fce7f3`);

function App() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [filterKategori, setFilterKategori] = useState('Semua');
  const [filterLokasi, setFilterLokasi] = useState('Semua');
  const [filterHarga, setFilterHarga] = useState('default');
  
  const [activePage, setActivePage] = useState('home'); 
  const [userRole, setUserRole] = useState('guest'); 

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('login'); 
  const [authLoading, setAuthLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // --- STATE PROFIL USER ---
  const [userProfile, setUserProfile] = useState({ nama: '', wa: '', avatar: AVATARS[0] });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const [userBookings, setUserBookings] = useState([]);
  const [allBookingsAdmin, setAllBookingsAdmin] = useState([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);

  // --- STATE ADMIN DASHBOARD & TAMBAH LAPANGAN ---
  const [adminTab, setAdminTab] = useState('transaksi'); 
  const [isAddFieldModalOpen, setIsAddFieldModalOpen] = useState(false);
  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldData, setNewFieldData] = useState({
    nama: '', jenis: 'Futsal', lokasi: '', harga: '', image: '', isMabar: false
  });

  // --- STATE DETAIL & BOOKING (MVP) ---
  const [selectedField, setSelectedField] = useState(null);
  const [fieldBookedDates, setFieldBookedDates] = useState({}); // Menyimpan jadwal: { '2026-06-28': ['16:00', '18:00'] }
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1); 
  const [splitCount, setSplitCount] = useState(1);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState('private'); 

  const [isMatchmakingModalOpen, setIsMatchmakingModalOpen] = useState(false);
  const [selectedMatchFieldId, setSelectedMatchFieldId] = useState(null);
  const [matchmakingTab, setMatchmakingTab] = useState('individu'); 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const [customPrompt, setCustomPrompt] = useState({
    isOpen: false, type: '', title: '', desc: '',
    val1: '', val2: '', onConfirm: null
  });

  const getMaxPlayers = (jenis) => {
    if (jenis?.toLowerCase() === 'minisoccer') return 14; 
    if (jenis?.toLowerCase() === 'futsal') return 10; 
    if (jenis?.toLowerCase() === 'badminton') return 4; 
    return 10; 
  };

  // --- FUNGSI RATING DINAMIS (Jika di database belum ada, ambil otomatis berdasarkan ID lapangan) ---
  const getDynamicRating = (f) => f.rating || (4 + (f.id.charCodeAt(0) % 10) / 10).toFixed(1);
  const getDynamicReviews = (f) => f.ulasanCount || (f.id.charCodeAt(1) * 3 + 12);

  const newsHighlights = [
    { id: 1, title: "Timnas Futsal Indonesia Bersiap Hadapi Piala Asia", category: "Futsal Nasional", date: "Hari Ini", image: "https://images.unsplash.com/photo-1511886929837-354d827aae26?q=80&w=600&auto=format&fit=crop" },
    { id: 2, title: "Turnamen Badminton Antar Kampus Semarang Segera Digelar di Udinus", category: "Event Semarang", date: "Kemarin", image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=600&auto=format&fit=crop" },
    { id: 3, title: "Tips Pemanasan Minisoccer Agar Tidak Mudah Cedera Engkel", category: "Tips & Trik", date: "2 Hari Lalu", image: "https://images.unsplash.com/photo-1517466787929-bc90951d0974?q=80&w=600&auto=format&fit=crop" },
  ];

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  useEffect(() => {
    const lapanganCollection = collection(db, 'lapangan');
    const unsubscribe = onSnapshot(lapanganCollection, (snapshot) => {
      const lapanganData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFields(lapanganData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const uniqueKategori = ['Semua', ...new Set(fields.map(f => f.jenis).filter(Boolean))];
  const uniqueLokasi = ['Semua', ...new Set(fields.map(f => f.lokasi).filter(Boolean))];

  let filteredFields = fields.filter(field => {
    const matchSearch = (field.nama && field.nama.toLowerCase().includes(searchQuery.toLowerCase())) ||
                        (field.lokasi && field.lokasi.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchStatus = filterStatus === 'Semua' || field.status === filterStatus;
    const matchKategori = filterKategori === 'Semua' || field.jenis === filterKategori;
    const matchLokasi = filterLokasi === 'Semua' || field.lokasi === filterLokasi;
    return matchSearch && matchStatus && matchKategori && matchLokasi;
  });

  if (filterHarga === 'terendah') filteredFields.sort((a, b) => a.harga - b.harga);
  else if (filterHarga === 'tertinggi') filteredFields.sort((a, b) => b.harga - a.harga);

  const liveMatchField = fields.find(f => f.id === selectedMatchFieldId);

  // --- SCROLL TO KATALOG FIX ---
  const handleNavKatalog = (e) => {
    e.preventDefault();
    setActivePage('home');
    setIsMobileMenuOpen(false);
    setTimeout(() => {
      document.getElementById('katalog')?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  // --- AUTHENTICATION & PROFILE ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return showToast("Email dan Password wajib diisi!", "error");
    setAuthLoading(true);
    try {
      if (authMode === 'register') {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const randomAvatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
        await setDoc(doc(db, 'users', userCred.user.uid), { email: userCred.user.email, role: 'user', nama: '', wa: '', avatar: randomAvatar });
        await signOut(auth);
        setAuthMode('login'); setPassword('');
        showToast("Registrasi berhasil! Silakan Login.", "success");
      } else {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'users', userCred.user.uid));
        
        let role = 'user';
        if (userDoc.exists()) {
          role = userDoc.data().role || 'user';
          setUserProfile({ 
            nama: userDoc.data().nama || '', 
            wa: userDoc.data().wa || '', 
            avatar: userDoc.data().avatar || AVATARS[0] 
          });
        }
        setUserRole(role); 
        
        setIsTransitioning(true); 
        setTimeout(() => {
          setIsTransitioning(false); 
          setActivePage(role === 'admin' ? 'admin-dashboard' : 'home'); 
          showToast(`Selamat datang, ${role === 'admin' ? 'Admin!' : 'Pemain!'}`, "success");
        }, 2200); 
      }
    } catch (error) {
      showToast("Email/Password salah atau sudah terdaftar!", "error");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) return showToast("Masukkan email kamu di kolom atas!", "error");
    try {
      await sendPasswordResetEmail(auth, email);
      showToast("Tautan reset password telah dikirim ke email kamu!", "success");
    } catch (error) { showToast("Gagal mengirim email. Pastikan terdaftar.", "error"); }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUserRole('guest'); setEmail(''); setPassword(''); setActivePage('home');
      setUserProfile({ nama: '', wa: '', avatar: AVATARS[0] });
      setIsMobileMenuOpen(false);
      showToast("Berhasil logout.", 'success');
    } catch (error) { showToast("Gagal logout.", 'error'); }
  };

  const updateProfile = async () => {
    setIsSavingProfile(true);
    try {
      const user = auth.currentUser;
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), { 
          nama: userProfile.nama, 
          wa: userProfile.wa,
          avatar: userProfile.avatar 
        });
        showToast("Profil berhasil diperbarui!", "success");
      }
    } catch (error) { showToast("Gagal menyimpan profil.", "error"); }
    finally { setIsSavingProfile(false); }
  };

  // --- FETCH BOOKINGS ---
  const fetchUserBookings = async () => {
    if (userRole === 'guest') return showToast("Silakan login dulu.", "error");
    setIsMobileMenuOpen(false);
    setActivePage('pesanan'); window.scrollTo(0, 0); setIsLoadingBookings(true);
    try {
      const q = query(collection(db, "bookings"), where("dipesanOleh", "==", email));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setUserBookings(data);
    } catch (error) { showToast("Gagal memuat pesanan.", "error"); } 
    finally { setIsLoadingBookings(false); }
  };

  const fetchAdminBookings = async () => {
    setIsMobileMenuOpen(false);
    setActivePage('admin-dashboard'); window.scrollTo(0, 0); setIsLoadingBookings(true);
    try {
      const snap = await getDocs(collection(db, "bookings"));
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setAllBookingsAdmin(data);
    } catch (error) { showToast("Gagal memuat data admin.", "error"); } 
    finally { setIsLoadingBookings(false); }
  };

  const konfirmasiPembayaranAdmin = async (bookingId) => {
    try {
      await updateDoc(doc(db, "bookings", bookingId), { statusPembayaran: "Lunas (Terkonfirmasi)" });
      showToast("Pembayaran dikonfirmasi!", "success");
      fetchAdminBookings(); 
    } catch (error) { showToast("Gagal update status.", "error"); }
  };

  const toggleStatusAdmin = async (lapangan) => {
    const newStatus = lapangan.status === 'Tersedia' ? 'Penuh' : 'Tersedia';
    try {
      const fieldRef = doc(db, "lapangan", lapangan.id);
      await updateDoc(fieldRef, { status: newStatus });
      showToast(`Status lapangan diubah menjadi ${newStatus}`, 'success');
    } catch (error) { showToast("Gagal mengubah status lapangan.", 'error'); }
  };

  // --- FUNGSI TAMBAH LAPANGAN (ADMIN) ---
  const handleAddNewField = async (e) => {
    e.preventDefault();
    if (!newFieldData.nama || !newFieldData.harga || !newFieldData.lokasi) {
      return showToast("Mohon lengkapi Nama, Lokasi, dan Harga!", "error");
    }
    
    setIsAddingField(true);
    try {
      const isMabarBool = newFieldData.isMabar === 'true' || newFieldData.isMabar === true;
      const maxP = getMaxPlayers(newFieldData.jenis);

      await addDoc(collection(db, 'lapangan'), {
        nama: newFieldData.nama,
        jenis: newFieldData.jenis,
        lokasi: newFieldData.lokasi,
        harga: Number(newFieldData.harga),
        image: newFieldData.image || 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?auto=format&fit=crop&w=600&q=80',
        isMabar: isMabarBool,
        slotMabar: isMabarBool ? maxP : 0,
        status: 'Tersedia',
        pemainTergabung: [],
        timTergabung: []
      });
      
      showToast("Data Lapangan berhasil ditambahkan!", "success");
      setIsAddFieldModalOpen(false);
      setNewFieldData({ nama: '', jenis: 'Futsal', lokasi: '', harga: '', image: '', isMabar: false });
    } catch (error) {
      showToast("Gagal menambahkan data.", "error");
    } finally {
      setIsAddingField(false);
    }
  };

  // --- LOGIKA HALAMAN DETAIL (MVP) ---
  const handleViewDetail = async (lapangan) => {
    setSelectedField(lapangan);
    setActivePage('detail');
    window.scrollTo(0, 0);
    
    // Set default ke hari ini
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setBookingDate(`${year}-${month}-${day}`);
    setBookingTime(''); 
    setFieldBookedDates({});

    // Ambil data jadwal dari Firebase untuk mapping Slot Waktu Kalender
    try {
      const q = query(collection(db, "bookings"), where("lapanganId", "==", lapangan.id));
      const snap = await getDocs(q);
      const booked = {};
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (!booked[data.tanggalMain]) booked[data.tanggalMain] = [];
        booked[data.tanggalMain].push(data.jamMain);
      });
      setFieldBookedDates(booked);
    } catch (error) {
      console.error("Gagal load data jadwal", error);
    }
  };

  const handleDateChange = (val) => {
    const offset = val.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(val.getTime() - offset);
    setBookingDate(adjustedDate.toISOString().split('T')[0]);
    setBookingTime(''); 
  };

  const tileClassName = ({ date, view }) => {
    if (view === 'month') {
      const offset = date.getTimezoneOffset() * 60000;
      const dateString = new Date(date.getTime() - offset).toISOString().split('T')[0];
      // Jika ke-4 slot waktu (16:00, 18:00, 19:00, 20:00) sudah di-booking, coret merah kalendernya
      if (fieldBookedDates[dateString] && fieldBookedDates[dateString].length >= 4) {
        return 'booked-date'; 
      }
    }
    return null;
  };

  const tileDisabled = ({ date, view }) => {
    if (view === 'month') {
      const offset = date.getTimezoneOffset() * 60000;
      const dateString = new Date(date.getTime() - offset).toISOString().split('T')[0];
      const today = new Date();
      const todayString = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      
      if (dateString < todayString) return true; // Disable hari yang sudah lewat
      if (fieldBookedDates[dateString] && fieldBookedDates[dateString].length >= 4) return true; // Disable jika full
    }
    return false;
  };


  // --- CHECKOUT FLOW ---
  const openBookingModal = (lapangan = selectedField, mode = 'private') => {
    if (userRole === 'guest') {
      showToast("Login dulu ya untuk booking.", 'error');
      setActivePage('login'); return;
    }

    if (activePage === 'detail') {
      if (!bookingDate || !bookingTime) {
        return showToast("Silakan pilih Tanggal dan Jam kosong terlebih dahulu!", "error");
      }
    } else {
      // Jika dari katalog langsung, set default
      setBookingDate(new Date().toISOString().split('T')[0]);
      setBookingTime('18:00');
    }

    setSelectedField(lapangan);
    setCheckoutMode(mode);
    setCheckoutStep(1); 
    
    if (mode === 'individu') setSplitCount(getMaxPlayers(lapangan.jenis));
    else if (mode === 'sparing') setSplitCount(2); 
    else setSplitCount(1);
    
    setIsModalOpen(true);
  };

  const processPayment = async () => {
    setIsProcessingPayment(true);
    try {
      let squadData = [];
      let labelMode = "Private Booking";
      if (checkoutMode === 'individu') {
        squadData = selectedField.pemainTergabung || [];
        labelMode = "Mabar Individu";
      } else if (checkoutMode === 'sparing') {
        squadData = selectedField.timTergabung || [];
        labelMode = "Sparing Antar Tim";
      }

      await addDoc(collection(db, "bookings"), {
        lapanganId: selectedField.id,
        lapanganNama: selectedField.nama,
        lokasi: selectedField.lokasi,
        totalBayar: selectedField.harga,
        jumlahPemainSplit: splitCount,
        tanggalMain: bookingDate,
        jamMain: bookingTime,
        squadContacts: squadData,
        matchMode: labelMode,
        createdAt: new Date().toISOString(),
        statusPembayaran: "Menunggu Verifikasi", 
        dipesanOleh: email 
      });

      if (checkoutMode !== 'private') {
        const fieldRef = doc(db, "lapangan", selectedField.id);
        await updateDoc(fieldRef, { status: "Penuh", pemainTergabung: [], timTergabung: [] });
      }

      setIsProcessingPayment(false);
      setCheckoutStep(3); 
    } catch (error) {
      setIsProcessingPayment(false);
      showToast("Terjadi kesalahan sistem.", 'error');
    }
  };

  // --- MATCHMAKING LOGIC ---
  const openMatchmakingModal = (lapangan) => {
    if (userRole === 'guest') {
      showToast("Login dulu ke Lobby Matchmaking!", 'error');
      setActivePage('login'); return;
    }
    setSelectedMatchFieldId(lapangan.id);
    setMatchmakingTab('individu'); 
    setIsMatchmakingModalOpen(true);
  };

  const joinMatchmaking = (type) => {
    if (!liveMatchField) return;
    const fieldRef = doc(db, "lapangan", liveMatchField.id);

    if (type === 'individu') {
      const maxP = getMaxPlayers(liveMatchField.jenis);
      const currentPlayers = liveMatchField.pemainTergabung || [];
      if (currentPlayers.some(p => p.includes(email))) return showToast("Kamu sudah ada di skuad.", "error");
      if (currentPlayers.length >= maxP) return showToast("Lobby Individu penuh!", "error");

      setCustomPrompt({
        isOpen: true, type: 'individu',
        title: "Masukkan Kontak Anda",
        desc: "Nomor WhatsApp diperlukan agar Host bisa menghubungi Anda untuk menagih biaya patungan lapangan.",
        val1: userProfile.wa || '', val2: '',
        onConfirm: async (waNumber) => {
          if (!waNumber || waNumber.length < 9) return showToast("Nomor WA tidak valid!", "error");
          const displayName = userProfile.nama ? `${userProfile.nama} (${email})` : email;
          const playerData = `${displayName} | WA: ${waNumber}`;
          try {
            await updateDoc(fieldRef, { pemainTergabung: arrayUnion(playerData) });
            showToast("Berhasil masuk skuad Individu!", "success");
            setCustomPrompt({ ...customPrompt, isOpen: false });
          } catch (error) { showToast("Gagal gabung skuad.", "error"); }
        }
      });

    } else if (type === 'sparing') {
      const currentTeams = liveMatchField.timTergabung || [];
      if (currentTeams.some(t => t.includes(email))) return showToast("Tim kamu sudah ada di lobby.", "error");
      if (currentTeams.length >= 2) return showToast("Lobby Sparing penuh!", "error");

      setCustomPrompt({
        isOpen: true, type: 'sparing',
        title: "Daftarkan Tim Sparing",
        desc: "Masukkan Nama Tim dan Nomor WA Kapten agar bisa berkomunikasi dengan tim lawan.",
        val1: userProfile.wa || '', val2: '',
        onConfirm: async (waNumber, namaTim) => {
          if (!waNumber || waNumber.length < 9) return showToast("Nomor WA tidak valid!", "error");
          if (!namaTim) return showToast("Nama Tim wajib diisi!", "error");
          const teamData = `${namaTim} (${email}) | WA: ${waNumber}`;
          try {
            await updateDoc(fieldRef, { timTergabung: arrayUnion(teamData) });
            showToast("Tim berhasil mendaftar Sparing!", "success");
            setCustomPrompt({ ...customPrompt, isOpen: false });
          } catch (error) { showToast("Gagal daftar tim.", "error"); }
        }
      });
    }
  };

  const leaveMatchmaking = async (type) => {
    if (!liveMatchField) return;
    const fieldRef = doc(db, "lapangan", liveMatchField.id);
    if (type === 'individu') {
      const currentPlayers = liveMatchField.pemainTergabung || [];
      const updatedPlayers = currentPlayers.filter(p => !p.includes(email)); 
      await updateDoc(fieldRef, { pemainTergabung: updatedPlayers });
      showToast("Kamu keluar dari skuad Individu.", "success");
    } else {
      const currentTeams = liveMatchField.timTergabung || [];
      const updatedTeams = currentTeams.filter(t => !t.includes(email)); 
      await updateDoc(fieldRef, { timTergabung: updatedTeams });
      showToast("Tim kamu keluar dari lobby Sparing.", "success");
    }
  };

  const proceedToBookingFromLobby = () => {
    setIsMatchmakingModalOpen(false);
    openBookingModal(liveMatchField, matchmakingTab); 
  };


  if (isTransitioning) {
    return (
      <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center min-h-screen">
        <div className="relative flex items-center justify-center h-32 w-32 mb-6">
          <div className="absolute inset-0 border-t-4 border-b-4 border-blue-600 rounded-full animate-spin shadow-sm"></div>
          <img src="/logo.png" alt="Loading" className="h-16 w-auto object-contain animate-pulse" />
        </div>
        <h2 className="text-slate-800 text-2xl font-black tracking-widest uppercase">Menyiapkan Ruang</h2>
        <p className="text-slate-500 text-sm mt-2 font-medium">Authenticating & Syncing...</p>
      </div>
    );
  }

  if (activePage === 'login') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
        <style>{`
          @keyframes diagonalMove {
            from { background-position: 0 0; }
            to { background-position: 500px 500px; }
          }
          .bg-pattern-move {
            background-image: url('/logo.png');
            background-size: 100px; /* Ukuran logo kecil-kecil */
            opacity: 0.08; /* Sangat samar agar tetap elegan */
            animation: diagonalMove 60s linear infinite; /* Gerakan sangat lambat dan halus */
          }
        `}</style>
        <div className="absolute inset-[-100%] bg-pattern-move pointer-events-none z-0 transform rotate-[15deg]"></div>

        <div className="fixed inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] select-none z-0">
          <img src="/logo.png" alt="Watermark" className="w-[120vw] md:w-[45vw] object-contain grayscale" />
        </div>
        {toast.show && (
          <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full font-bold shadow-xl animate-in slide-in-from-top-5 text-sm w-11/12 md:w-auto text-center ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'}`}>{toast.message}</div>
        )}
        <div className="bg-white/90 backdrop-blur-sm p-6 md:p-8 rounded-3xl shadow-xl w-full max-w-md text-center border border-slate-100 z-10 relative overflow-hidden">
          
          {/* Watermark Logo DI DALAM Kartu Login */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.1] select-none z-0">
            <img src="/logo.png" alt="Watermark" className="w-3/4 object-contain grayscale" />
          </div>

          <div className="relative z-10">
            <img src="/logo.png" alt="Logo" className="h-16 w-auto mx-auto mb-4 object-contain" />
            <h2 className="text-2xl font-extrabold text-slate-800 mb-2">{authMode === 'login' ? 'Akses SportSpace' : 'Daftar Akun'}</h2>
            <p className="text-slate-500 mb-8 text-sm">{authMode === 'login' ? 'Gunakan email yang sudah terdaftar di SportSpace.' : 'Lengkapi data valid.'}</p>
            <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Email</label>
                <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 bg-white/80 text-sm" required/>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-600 ml-1">Password</label>
                  {authMode === 'login' && (
                    <button type="button" onClick={handleResetPassword} className="text-[10px] font-bold text-blue-600 hover:underline">Lupa password?</button>
                  )}
                </div>
                <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 bg-white/80 text-sm" required/>
              </div>
              <button type="submit" disabled={authLoading} className="w-full mt-2 py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition flex justify-center shadow-md shadow-blue-600/20 active:scale-95">
                {authLoading ? <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (authMode === 'login' ? 'Masuk' : 'Daftar')}
              </button>
            </form>
            <div className="mt-6 text-sm text-slate-500">
              {authMode === 'login' ? "Belum punya akun? " : "Sudah punya akun? "}
              <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="font-bold text-blue-600 hover:underline">{authMode === 'login' ? 'Daftar' : 'Login'}</button>
              <br/><button onClick={() => setActivePage('home')} className="mt-4 px-5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 text-xs font-bold rounded-full transition border border-slate-200">&larr; Kembali ke Beranda</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =====================================
  // DASHBOARD ADMIN PROPER
  // =====================================
  if (activePage === 'admin-dashboard') {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col relative overflow-x-hidden">
        
        {/* WATERMARK BACKGROUND */}
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] select-none z-0">
          <img src="/logo.png" alt="Watermark" className="w-[120vw] md:w-[45vw] object-contain grayscale" />
        </div>

        {toast.show && (
          <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full font-bold shadow-xl animate-in slide-in-from-top-5 text-sm w-11/12 md:w-auto text-center ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'}`}>{toast.message}</div>
        )}

        <nav className="bg-slate-900 text-white p-4 sticky top-0 z-40 shadow-md">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="bg-white p-1 rounded-md"><img src="/logo.png" alt="Logo" className="h-6 w-auto" /></div>
              <span className="text-xl font-bold tracking-widest text-red-400">ADMIN<span className="text-white hidden sm:inline">PANEL</span></span>
            </div>
            
            <div className="hidden md:flex gap-6 items-center text-sm font-bold">
              <button onClick={() => { setActivePage('home'); window.scrollTo(0,0); }} className="text-slate-300 hover:text-white">Lihat Web (User View)</button>
              <button onClick={fetchAdminBookings} className="text-blue-400 hover:text-blue-300">Refresh Data</button>
              <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition">Logout</button>
            </div>

            <div className="md:hidden flex items-center">
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-300 hover:text-white focus:outline-none">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMobileMenuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />}
                </svg>
              </button>
            </div>
          </div>

          {isMobileMenuOpen && (
            <div className="md:hidden absolute top-full left-0 w-full bg-slate-800 shadow-xl border-t border-slate-700 animate-in slide-in-from-top-2">
              <div className="flex flex-col px-4 py-3 gap-3 text-sm font-bold">
                <button onClick={() => { setIsMobileMenuOpen(false); setActivePage('home'); window.scrollTo(0,0); }} className="text-left text-slate-300 py-2 border-b border-slate-700">Lihat Web (User View)</button>
                <button onClick={() => { setIsMobileMenuOpen(false); fetchAdminBookings(); }} className="text-left text-blue-400 py-2 border-b border-slate-700">Refresh Data</button>
                <button onClick={handleLogout} className="text-left text-red-400 py-2">Logout Admin</button>
              </div>
            </div>
          )}
        </nav>

        <main className="max-w-7xl mx-auto p-4 md:p-6 w-full flex-grow pt-6 md:pt-10 z-10 relative">
          
          {/* HEADER & TAB SWITCHER */}
          <div className="mb-6 md:mb-8">
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-1 md:mb-2">Admin Dashboard</h2>
            <div className="flex gap-6 border-b border-slate-200 mt-4">
              <button onClick={() => setAdminTab('transaksi')} className={`pb-3 text-sm md:text-base font-bold transition-colors relative ${adminTab === 'transaksi' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                Verifikasi Transaksi
                {adminTab === 'transaksi' && <span className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-md"></span>}
              </button>
              <button onClick={() => setAdminTab('lapangan')} className={`pb-3 text-sm md:text-base font-bold transition-colors relative ${adminTab === 'lapangan' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                Kelola Lapangan
                {adminTab === 'lapangan' && <span className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-md"></span>}
              </button>
            </div>
          </div>

          {/* TAB 1: TRANSAKSI */}
          {adminTab === 'transaksi' && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              {isLoadingBookings ? (
                <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-300 border-t-blue-600"></div></div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                          <th className="p-4 font-bold">ID Order</th>
                          <th className="p-4 font-bold">Pemesan & Mode</th>
                          <th className="p-4 font-bold">Lapangan & Jadwal</th>
                          <th className="p-4 font-bold">Total (Split)</th>
                          <th className="p-4 font-bold">Status Pembayaran</th>
                          <th className="p-4 font-bold text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm divide-y divide-slate-100">
                        {allBookingsAdmin.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50 transition">
                            <td className="p-4 font-mono text-xs text-slate-400">{b.id.substring(0,8).toUpperCase()}</td>
                            <td className="p-4">
                              <p className="font-bold text-slate-700">{b.dipesanOleh}</p>
                              <span className="text-[9px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase font-bold">{b.matchMode || 'Private Booking'}</span>
                            </td>
                            <td className="p-4">
                              <p className="font-bold text-slate-800">{b.lapanganNama}</p>
                              <p className="text-xs text-slate-500 mt-0.5">📅 {b.tanggalMain} | ⏰ {b.jamMain} WIB</p>
                            </td>
                            <td className="p-4">
                              <p className="font-bold text-slate-800">Rp {b.totalBayar.toLocaleString()}</p>
                              {b.jumlahPemainSplit > 1 && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">Split {b.jumlahPemainSplit}</span>}
                            </td>
                            <td className="p-4">
                              <span className={`px-3 py-1 text-xs font-bold rounded-full ${b.statusPembayaran.includes('Lunas') ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                {b.statusPembayaran}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              {b.statusPembayaran === "Menunggu Verifikasi" ? (
                                <button onClick={() => konfirmasiPembayaranAdmin(b.id)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm active:scale-95 whitespace-nowrap">Verifikasi Uang Masuk</button>
                              ) : (
                                <span className="text-slate-300 text-xs font-bold">Selesai</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {allBookingsAdmin.length === 0 && (
                          <tr><td colSpan="6" className="p-8 text-center text-slate-400">Belum ada transaksi masuk.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: KELOLA LAPANGAN */}
          {adminTab === 'lapangan' && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-slate-500">Daftar semua lapangan yang aktif di aplikasi.</p>
                <button onClick={() => setIsAddFieldModalOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-white text-xs md:text-sm font-bold px-4 md:px-5 py-2 md:py-2.5 rounded-xl shadow-md transition flex items-center gap-2">
                  <span className="text-lg leading-none">+</span> Tambah Lapangan
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                          <th className="p-4 font-bold">Gambar</th>
                          <th className="p-4 font-bold">Nama Lapangan</th>
                          <th className="p-4 font-bold">Kategori & Lokasi</th>
                          <th className="p-4 font-bold">Tarif / Jam</th>
                          <th className="p-4 font-bold">Fitur Mabar</th>
                          <th className="p-4 font-bold text-center">Status / Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm divide-y divide-slate-100">
                        {fields.map((f) => (
                          <tr key={f.id} className="hover:bg-slate-50 transition">
                            <td className="p-4">
                              <div className="w-16 h-12 rounded-lg overflow-hidden bg-slate-200">
                                <img src={f.image || 'https://via.placeholder.com/150'} alt={f.nama} className="w-full h-full object-cover" />
                              </div>
                            </td>
                            <td className="p-4 font-bold text-slate-800">{f.nama}</td>
                            <td className="p-4">
                              <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{f.jenis}</span>
                              <p className="text-xs text-slate-500 mt-1 truncate max-w-[150px]">{f.lokasi}</p>
                            </td>
                            <td className="p-4 font-bold text-slate-800">Rp {f.harga?.toLocaleString()}</td>
                            <td className="p-4">
                              {f.isMabar ? <span className="text-green-500 font-bold text-xs">✅ Aktif</span> : <span className="text-slate-400 font-bold text-xs">❌ Nonaktif</span>}
                            </td>
                            <td className="p-4 text-center">
                               <button onClick={() => toggleStatusAdmin(f)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition shadow-sm border whitespace-nowrap ${f.status === 'Tersedia' ? 'border-slate-300 text-slate-600 hover:bg-slate-100' : 'bg-green-50 border-green-500 text-green-600 hover:bg-green-100'}`}>
                                {f.status === 'Tersedia' ? 'Tutup (Penuh)' : 'Buka (Tersedia)'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              </div>
            </div>
          )}
        </main>

        {/* MODAL TAMBAH LAPANGAN BARU */}
        {isAddFieldModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
              
              <div className="bg-slate-900 text-white p-5 md:p-6 shrink-0 relative">
                <button onClick={() => setIsAddFieldModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold">✖</button>
                <h2 className="text-xl font-black flex items-center gap-2">📝 Tambah Lapangan Baru</h2>
                <p className="text-slate-400 text-xs mt-1">Data akan langsung tersinkronisasi ke katalog User.</p>
              </div>
              
              <div className="p-5 md:p-6 overflow-y-auto flex-grow bg-slate-50">
                <form id="addFieldForm" onSubmit={handleAddNewField} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Nama Lapangan *</label>
                    <input type="text" value={newFieldData.nama} onChange={(e)=>setNewFieldData({...newFieldData, nama: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 text-sm font-bold text-slate-800" placeholder="Misal: GOR Udinus" required/>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Kategori *</label>
                      <select value={newFieldData.jenis} onChange={(e)=>setNewFieldData({...newFieldData, jenis: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 text-sm font-bold text-slate-800 bg-white">
                        <option value="Futsal">Futsal</option>
                        <option value="Minisoccer">Minisoccer</option>
                        <option value="Badminton">Badminton</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Tarif per Jam (Rp) *</label>
                      <input type="number" value={newFieldData.harga} onChange={(e)=>setNewFieldData({...newFieldData, harga: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 text-sm font-bold text-slate-800" placeholder="50000" required/>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Lokasi / Area *</label>
                    <input type="text" value={newFieldData.lokasi} onChange={(e)=>setNewFieldData({...newFieldData, lokasi: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 text-sm font-bold text-slate-800" placeholder="Misal: Semarang Tengah" required/>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Link Gambar (URL) opsional</label>
                    <input type="url" value={newFieldData.image} onChange={(e)=>setNewFieldData({...newFieldData, image: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 text-sm font-medium text-slate-700" placeholder="https://..." />
                    <p className="text-[9px] text-slate-400 mt-1">Kosongkan jika ingin pakai gambar default bawaan sistem.</p>
                  </div>

                  <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center justify-between mt-2">
                    <div>
                      <p className="text-xs font-bold text-blue-900">Aktifkan Fitur Mabar?</p>
                      <p className="text-[9px] text-blue-600 mt-0.5">Izinkan user mencari lawan/teman patungan di lapangan ini.</p>
                    </div>
                    <select value={newFieldData.isMabar} onChange={(e)=>setNewFieldData({...newFieldData, isMabar: e.target.value})} className="px-3 py-1.5 rounded-lg border border-blue-200 text-xs font-bold text-slate-700 bg-white">
                      <option value={false}>Tidak</option>
                      <option value={true}>Ya, Aktifkan</option>
                    </select>
                  </div>
                </form>
              </div>
              
              <div className="p-4 md:p-5 bg-white border-t border-slate-100 shrink-0">
                <button type="submit" form="addFieldForm" disabled={isAddingField} className="w-full py-3.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-md transition active:scale-95 flex justify-center">
                  {isAddingField ? <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Simpan & Publikasikan'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =====================================
  // RENDER UTAMA (HOME, PESANAN, PROFIL)
  // =====================================
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col scroll-smooth relative overflow-x-hidden print:bg-white print:m-0 print:p-0">
      
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] select-none z-0">
        <img src="/logo.png" alt="Watermark" className="w-[120vw] md:w-[45vw] object-contain grayscale" />
      </div>

      <style>{`
        @keyframes scroll-cylinder { 0% { transform: translateY(-50%); } 100% { transform: translateY(0%); } }
        .animate-news-scroll { animation: scroll-cylinder 15s linear infinite; }
        .animate-news-scroll:hover { animation-play-state: paused; }
        .cylinder-mask { -webkit-mask-image: linear-gradient(to bottom, transparent, black 15%, black 85%, transparent); mask-image: linear-gradient(to bottom, transparent, black 15%, black 85%, transparent); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; }
          .no-print { display: none !important; }
        }
        /* Animasi Bergerak Diagonal untuk Watermark */
        @keyframes diagonalMove {
          from { background-position: 0 0; }
          to { background-position: 500px 500px; }
        }
        .bg-pattern-move {
          background-image: url('/logo.png');
          background-size: 100px; 
          opacity: 0.08; 
          animation: diagonalMove 60s linear infinite; 
        }
        /* CSS Untuk React Calendar Custom MVP */
        .react-calendar { border: none !important; width: 100% !important; background: transparent !important; font-family: inherit !important; }
        .react-calendar__navigation button { font-weight: 900; font-size: 1.1rem; border-radius: 8px; }
        .react-calendar__tile { padding: 1em 0.5em !important; font-weight: bold; border-radius: 12px; }
        .react-calendar__tile--now { background: #eff6ff !important; color: #2563eb; }
        .react-calendar__tile--active { background: #2563eb !important; color: white !important; }
        .react-calendar__tile:disabled { background-color: #f1f5f9; color: #cbd5e1; }
        .booked-date { background: #fee2e2 !important; color: #ef4444 !important; text-decoration: line-through; pointer-events: none; opacity: 0.6; }
      `}</style>

      {toast.show && (
        <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl font-bold shadow-2xl animate-in fade-in slide-in-from-bottom-5 text-sm w-11/12 md:w-auto justify-center text-center ${toast.type === 'success' ? 'bg-slate-900 text-green-400 border border-slate-700' : 'bg-red-600 text-white'} no-print`}>
          <span>{toast.type === 'success' ? '✅' : '⚠️'}</span><span>{toast.message}</span>
        </div>
      )}

      {/* NAVBAR USER */}
      <nav className="bg-white/95 backdrop-blur-md text-slate-800 p-4 sticky top-0 z-40 shadow-sm border-b border-slate-200 no-print">
        <div className="max-w-6xl mx-auto flex justify-between items-center relative z-10">
          <div className="flex items-center gap-2 cursor-pointer z-50" onClick={() => { setActivePage('home'); window.scrollTo(0,0); }}>
            <img src="/logo.png" alt="Logo" className="h-8 w-auto object-contain" />
            <span className="text-2xl font-black tracking-tight text-slate-900">SportSpace</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 font-bold text-sm text-slate-500">
            <a href="#" onClick={(e) => { e.preventDefault(); setActivePage('home'); window.scrollTo(0,0); }} className={`${activePage === 'home' ? 'text-blue-600' : 'hover:text-blue-600'} transition-colors`}>Beranda</a>
            <a href="#katalog" onClick={handleNavKatalog} className="hover:text-blue-600 transition-colors">Katalog Lapangan</a>
            <a href="#pesanan" onClick={(e) => { e.preventDefault(); fetchUserBookings(); }} className={`${activePage === 'pesanan' ? 'text-blue-600' : 'hover:text-blue-600'} transition-colors`}>Pesanan Saya</a>
            
            {userRole === 'admin' && (
              <a href="#" onClick={(e) => { e.preventDefault(); fetchAdminBookings(); }} className="text-red-500 hover:text-red-600 transition-colors bg-red-50 px-3 py-1 rounded font-black tracking-wide">Dashboard Admin &rarr;</a>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:block">
              {userRole === 'guest' ? (
                <button onClick={() => setActivePage('login')} className="text-sm font-bold bg-slate-900 hover:bg-blue-600 text-white px-6 py-2.5 rounded-full transition shadow-md">Masuk / Daftar</button>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 cursor-pointer group p-1.5 hover:bg-slate-50 rounded-full transition" onClick={() => { setActivePage('profil'); window.scrollTo(0,0); }}>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-blue-500 transition">Profil ⚙️</span>
                      <span className="text-xs font-bold text-slate-700 truncate max-w-[100px]">{userProfile.nama || email.split('@')[0]}</span>
                    </div>
                    <img src={userProfile.avatar} alt="Avatar" className="w-9 h-9 rounded-full bg-slate-100 border-2 border-white shadow-sm group-hover:scale-105 transition-transform" />
                  </div>
                  <button onClick={handleLogout} className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition">Logout</button>
                </div>
              )}
            </div>
            <div className="md:hidden flex items-center gap-3">
               {userRole !== 'guest' && (
                 <img src={userProfile.avatar} alt="Avatar" onClick={() => { setActivePage('profil'); window.scrollTo(0,0); }} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 shadow-sm cursor-pointer" />
               )}
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-600 hover:text-blue-600 focus:outline-none transition-colors">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMobileMenuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white shadow-xl border-t border-slate-100 animate-in slide-in-from-top-2 z-50">
            <div className="flex flex-col px-6 py-4 gap-4 text-base font-bold text-slate-600 relative z-20">
              {userRole !== 'guest' && (
                <div className="pb-3 border-b border-slate-100 flex justify-between items-center cursor-pointer" onClick={() => { setIsMobileMenuOpen(false); setActivePage('profil'); window.scrollTo(0,0); }}>
                  <div className="flex items-center gap-3">
                    <img src={userProfile.avatar} className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest leading-none mb-1">Profil Saya ⚙️</p>
                      <p className="text-sm text-slate-800 truncate max-w-[180px]">{userProfile.nama || email}</p>
                    </div>
                  </div>
                  <span className="text-blue-500 text-xs bg-blue-50 px-2 py-1 rounded">Edit</span>
                </div>
              )}
              
              <a href="#" onClick={(e) => { e.preventDefault(); setIsMobileMenuOpen(false); setActivePage('home'); window.scrollTo(0,0); }} className={`${activePage === 'home' ? 'text-blue-600' : 'hover:text-blue-600'}`}>Beranda</a>
              <a href="#katalog" onClick={handleNavKatalog} className="hover:text-blue-600">Katalog Lapangan</a>
              <a href="#pesanan" onClick={(e) => { e.preventDefault(); fetchUserBookings(); }} className={`${activePage === 'pesanan' ? 'text-blue-600' : 'hover:text-blue-600'}`}>Pesanan Saya</a>
              
              {userRole === 'admin' && (
                <a href="#" onClick={(e) => { e.preventDefault(); fetchAdminBookings(); }} className="text-red-500 py-2 border-t border-slate-100 mt-2">Masuk Dashboard Admin &rarr;</a>
              )}
              
              <div className="pt-4 mt-2 border-t border-slate-100">
                {userRole === 'guest' ? (
                  <button onClick={() => { setIsMobileMenuOpen(false); setActivePage('login'); }} className="w-full text-center text-sm font-bold bg-blue-600 text-white py-3 rounded-xl shadow-md">Masuk / Daftar</button>
                ) : (
                  <button onClick={handleLogout} className="w-full text-center text-sm font-bold bg-red-50 text-red-600 py-3 rounded-xl border border-red-100">Logout Akun</button>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ========================================================= */}
      {/* --- HALAMAN DETAIL LAPANGAN (NEW MVP FEATURE) ---         */}
      {/* ========================================================= */}
      {activePage === 'detail' && selectedField ? (
        <main className="max-w-6xl mx-auto p-4 md:p-6 w-full flex-grow pt-8 pb-20 animate-in fade-in duration-500 relative z-10">
          
          <button onClick={handleNavKatalog} className="mb-6 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition">
            ← Kembali ke Katalog
          </button>

          <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
            {/* Header / Hero Image Detail */}
            <div className="h-64 md:h-96 w-full relative">
              <img src={selectedField.image} alt={selectedField.nama} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-6 md:p-10 w-full flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <span className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase mb-3 inline-block shadow-lg">
                    {selectedField.jenis}
                  </span>
                  <h1 className="text-3xl md:text-5xl font-black text-white leading-tight drop-shadow-lg">{selectedField.nama}</h1>
                  <p className="text-slate-300 font-medium mt-2 text-sm md:text-base flex items-center gap-2">📍 {selectedField.lokasi}</p>
                </div>
                <div className="text-left md:text-right">
                  <div className="flex items-center md:justify-end gap-1 text-yellow-400 mb-1">
                    <span className="text-2xl">★</span><span className="text-xl font-black text-white">{getDynamicRating(selectedField)}</span>
                  </div>
                  <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">({getDynamicReviews(selectedField)} Ulasan Google)</p>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
              
              {/* Kolom Kiri: Peta dan Info */}
              <div className="lg:col-span-7 space-y-10">
                
                {/* Deskripsi & Harga */}
                <div>
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Informasi Lapangan</h3>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">TARIF PER JAM</p>
                      <p className="text-3xl font-black text-blue-600">Rp {selectedField.harga?.toLocaleString()}</p>
                    </div>
                    {selectedField.status === 'Tersedia' ? (
                      <span className="bg-green-100 text-green-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-green-200">TERSEDIA</span>
                    ) : (
                      <span className="bg-red-100 text-red-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-red-200">PENUH / TUTUP</span>
                    )}
                  </div>
                </div>

                {/* Integrasi Peta Google Maps (Simulasi API) */}
                <div>
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">Lokasi Google Maps</h3>
                  <div className="w-full h-64 bg-slate-200 rounded-3xl overflow-hidden border-4 border-slate-100 shadow-inner relative">
                    <iframe 
                      src={selectedField.embedMap || `https://maps.google.com/maps?q=${encodeURIComponent(selectedField.nama + ' ' + selectedField.lokasi)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                      width="100%" 
                      height="100%" 
                      style={{ border: 0 }} 
                      allowFullScreen="" 
                      loading="lazy" 
                      referrerPolicy="no-referrer-when-downgrade"
                      className="absolute inset-0"
                    ></iframe>
                  </div>
                </div>

                {/* Ulasan (Social Proof) */}
                <div>
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">Ulasan Pengunjung</h3>
                  <div className="space-y-4">
                    {/* Dummy Reviews untuk MVP */}
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-black text-blue-600 text-xs">B</div>
                          <div><p className="font-bold text-sm text-slate-800 leading-none">Budi Santoso</p><p className="text-[9px] text-slate-400 mt-1">Local Guide • 1 minggu lalu</p></div>
                        </div>
                        <span className="text-yellow-400 text-xs">★★★★★</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-3 leading-relaxed">Lapangannya sangat terawat, rumput sintetisnya masih bagus dan empuk. Fasilitas ruang ganti dan kamar mandinya juga bersih. Mantap!</p>
                    </div>

                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center font-black text-red-600 text-xs">A</div>
                          <div><p className="font-bold text-sm text-slate-800 leading-none">Agus Pratama</p><p className="text-[9px] text-slate-400 mt-1">3 minggu lalu</p></div>
                        </div>
                        <span className="text-yellow-400 text-xs">★★★★☆</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-3 leading-relaxed">Parkiran luas, akses mudah. Sayang pencahayaan kalau malam agak kurang di pojokan. Selebihnya oke banget buat mabar rutin.</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Kolom Kanan: Kalender & Time Slots */}
              <div className="lg:col-span-5">
                <div className="sticky top-24 bg-white rounded-3xl border border-slate-200 shadow-xl p-6 md:p-8">
                  
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-2 text-center">Jadwal & Ketersediaan</h3>
                  <p className="text-xs text-slate-500 text-center mb-6">Pilih tanggal dan jam kosong.</p>
                  
                  {/* KALENDER REACT */}
                  <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 mb-6">
                    <Calendar 
                      onChange={handleDateChange}
                      value={new Date(bookingDate || Date.now())}
                      tileDisabled={tileDisabled}
                      tileClassName={tileClassName}
                      className="w-full border-0 font-sans text-sm bg-transparent"
                      minDate={new Date()}
                    />
                  </div>

                  <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-slate-500 mb-6">
                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span> Terpilih / Hari Ini</div>
                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-200 inline-block"></span> Penuh (Coret Merah)</div>
                  </div>

                  {/* SLOT WAKTU (MVP UPDATE) */}
                  <div className="mb-8">
                     <p className="text-xs font-bold text-slate-800 mb-3 text-center uppercase tracking-widest">PILIH JAM MAIN (UNTUK {bookingDate})</p>
                     <div className="grid grid-cols-4 gap-2">
                        {["16:00", "18:00", "19:00", "20:00"].map(time => {
                            // Cek apakah di database tanggal ini dan jam ini sudah di booking
                            const isBooked = fieldBookedDates[bookingDate]?.includes(time);
                            const isSelected = bookingTime === time;
                            return (
                                <button
                                   key={time}
                                   disabled={isBooked}
                                   onClick={() => setBookingTime(time)}
                                   className={`py-3 rounded-xl text-xs font-bold transition-all shadow-sm ${isBooked ? 'bg-red-50 text-red-400 line-through cursor-not-allowed border border-red-100' : isSelected ? 'bg-blue-600 text-white shadow-md shadow-blue-200 border border-blue-600' : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'}`}
                                >
                                   {time}
                                </button>
                            )
                        })}
                     </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="space-y-3">
                    <button 
                      onClick={() => openBookingModal(selectedField, 'private')} 
                      disabled={selectedField.status !== 'Tersedia'} 
                      className={`w-full py-4 text-sm font-black rounded-2xl transition shadow-lg flex items-center justify-center gap-2 ${selectedField.status === 'Tersedia' ? 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                    >
                      {selectedField.status === 'Tersedia' ? '🔒 PRIVATE BOOKING' : 'LAPANGAN PENUH'}
                    </button>
                    
                    {selectedField.isMabar && selectedField.status === 'Tersedia' && (
                      <button 
                        onClick={() => openMatchmakingModal(selectedField)} 
                        className="w-full py-4 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-black rounded-2xl transition border border-blue-200 active:scale-95 flex items-center justify-center gap-2"
                      >
                        ⚔️ CEK LOBBY MABAR
                      </button>
                    )}
                  </div>

                </div>
              </div>

            </div>
          </div>
        </main>

      ) : activePage === 'profil' ? (
        /* --- HALAMAN PROFIL USER --- */
        <main className="max-w-xl mx-auto p-4 md:p-6 w-full flex-grow pt-8 md:pt-12 pb-20 animate-in fade-in duration-300 no-print relative z-10">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 relative">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 md:gap-6 mb-8 border-b border-slate-100 pb-8 text-center sm:text-left">
              
              <div className="relative group cursor-pointer" onClick={() => setIsAvatarModalOpen(true)}>
                <div className="w-24 h-24 rounded-full bg-slate-100 border-4 border-white shadow-lg overflow-hidden group-hover:opacity-80 transition-opacity">
                  <img src={userProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                </div>
                <div className="absolute inset-0 bg-slate-900/40 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white text-xs font-bold">✎ Ubah</span>
                </div>
              </div>

              <div className="pt-2">
                <h2 className="text-2xl font-black text-slate-800">{userProfile.nama || 'Pengguna Baru'}</h2>
                <p className="text-sm text-slate-500 font-medium">{email}</p>
                <button onClick={() => setIsAvatarModalOpen(true)} className="mt-3 text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition">Pilih Avatar Karakter &rarr;</button>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Nama Lengkap / Tim</label>
                <input type="text" value={userProfile.nama} onChange={(e)=>setUserProfile({...userProfile, nama: e.target.value})} placeholder="Misal: Faza Wahyu" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 bg-slate-50 text-sm font-bold text-slate-800 relative z-10" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Nomor WhatsApp Aktif</label>
                <input type="number" value={userProfile.wa} onChange={(e)=>setUserProfile({...userProfile, wa: e.target.value})} placeholder="Misal: 081234567890" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 bg-slate-50 text-sm font-bold text-slate-800 relative z-10" />
                <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">
                  *Nomor WA ini akan diisi otomatis (Auto-fill) saat kamu mendaftar Skuad Matchmaking/Sparing.
                </p>
              </div>
              
              <button onClick={updateProfile} disabled={isSavingProfile} className="w-full py-3.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 shadow-md flex justify-center items-center mt-4 transition active:scale-95 relative z-10">
                {isSavingProfile ? <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Simpan Profil'}
              </button>
            </div>
          </div>
        </main>

      ) : activePage === 'pesanan' ? (
        
        <main className="max-w-4xl mx-auto p-4 md:p-6 w-full flex-grow pt-8 md:pt-12 pb-20 animate-in fade-in duration-300 relative z-10">
          <div className="flex justify-between items-end mb-6 md:mb-8 no-print">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 mb-1 md:mb-2">Tiket & Pesanan Saya</h2>
              <p className="text-slate-500 text-xs md:text-sm">Unduh tiket PDF atau tunjukkan QR ini ke penjaga lapangan saat datang.</p>
            </div>
          </div>

          {isLoadingBookings ? (
            <div className="flex justify-center py-20 no-print"><div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600"></div></div>
          ) : userBookings.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm mx-2 no-print">
              <span className="text-4xl mb-4 block">🎟️</span>
              <h3 className="font-bold text-lg text-slate-700">Belum ada tiket</h3>
              <p className="text-slate-500 text-sm mt-1 mb-4">Kamu belum mem-booking lapangan apapun.</p>
              <button onClick={() => setActivePage('home')} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 relative z-10">Cari Lapangan Sekarang</button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {userBookings.map((booking, index) => (
                <div key={booking.id} className={`bg-white border border-slate-200 rounded-2xl flex flex-col md:flex-row overflow-hidden shadow-sm hover:shadow-md transition mx-2 md:mx-0 relative z-10 ${index === 0 ? 'print-area' : 'no-print'}`}>
                  
                  <div className={`md:w-1/3 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-200 border-dashed ${booking.statusPembayaran.includes('Lunas') ? 'bg-blue-50' : 'bg-slate-50'}`}>
                    <p className={`text-xs font-black uppercase tracking-widest mb-4 px-3 py-1 rounded-full text-center shadow-sm ${booking.statusPembayaran.includes('Lunas') ? 'bg-green-200 text-green-700' : 'bg-orange-200 text-orange-700'}`}>
                      {booking.statusPembayaran}
                    </p>
                    <div className={`w-32 h-32 p-2 rounded-xl mb-3 ${booking.statusPembayaran.includes('Lunas') ? 'bg-white shadow-sm border border-slate-100' : 'bg-slate-200 opacity-50'} flex items-center justify-center relative z-10`}>
                      {booking.statusPembayaran.includes('Lunas') ? (
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${booking.id}`} alt="QR Ticket" className="w-full h-full" />
                      ) : (
                        <span className="text-[10px] text-center text-slate-500 font-bold px-2">QR Muncul Setelah Lunas</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono tracking-widest mb-2">ID: {booking.id.substring(0,10).toUpperCase()}</span>

                    {!booking.statusPembayaran.includes('Lunas') && (
                      <a 
                        href={`mailto:halo@sportspace.id?subject=Konfirmasi%20Pembayaran%20-%20${booking.id.substring(0,10).toUpperCase()}&body=Halo%20Admin%20SportSpace%2C%0A%0ASaya%20ingin%20mengkonfirmasi%20pembayaran%20pesanan%20lapangan%20saya.%20Berikut%20adalah%20detailnya%3A%0A%0A-%20ID%20Pesanan%20%3A%20${booking.id.substring(0,10).toUpperCase()}%0A-%20Nama%20Lapangan%20%3A%20${booking.lapanganNama}%0A-%20Jadwal%20%3A%20${booking.tanggalMain}%20jam%20${booking.jamMain}%20WIB%0A-%20Total%20Tagihan%20%3A%20Rp%20${booking.totalBayar.toLocaleString('id-ID')}%0A%0A*Mohon%20lampirkan%20foto%2Fscreenshot%20bukti%20transfer%20Anda%20pada%20email%20ini.*%0A%0ATerima%20kasih!`} 
                        className="mt-2 text-[10px] font-bold bg-slate-800 text-white px-4 py-2.5 rounded-full flex items-center justify-center gap-1.5 hover:bg-slate-700 transition shadow-md w-full no-print active:scale-95 relative z-10"
                      >
                        ✉️ Kirim Bukti via Email
                      </a>
                    )}
                  </div>

                  <div className="p-5 md:p-6 md:w-2/3 flex flex-col justify-between relative">
                    {booking.statusPembayaran.includes('Lunas') && (
                      <button onClick={() => window.print()} className="absolute top-4 right-4 z-20 w-max text-[10px] font-bold bg-slate-800 text-white px-3 py-2 rounded-lg flex items-center gap-1.5 hover:bg-slate-700 transition shadow-md no-print active:scale-95">
                        <span className="text-xs">🖨️</span> Cetak Tiket PDF
                      </button>
                    )}

                    <div>
                      <div className="flex justify-between items-start mt-4 md:mt-0">
                        <div>
                          <h3 className="text-xl md:text-2xl font-black text-slate-800 pr-24">{booking.lapanganNama}</h3>
                          <p className="text-xs md:text-sm text-slate-500 mt-1 mb-4 flex items-center gap-1.5">📍 {booking.lokasi || "Semarang"}</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-1 items-start mb-4 relative z-10">
                        <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-2 py-1 rounded uppercase tracking-widest">{booking.matchMode || 'Private Booking'}</span>
                        {booking.squadContacts && booking.squadContacts.length > 0 && (
                          <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider shadow-sm">Host (Tuan Rumah)</span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 md:gap-4 mb-4 relative z-10">
                        <div className="bg-slate-50 p-2.5 md:p-3 rounded-xl border border-slate-100">
                          <p className="text-[9px] md:text-[10px] uppercase font-bold text-slate-400 mb-0.5 md:mb-1">Tanggal Main</p>
                          <p className="font-bold text-xs md:text-sm text-slate-700">{booking.tanggalMain}</p>
                        </div>
                        <div className="bg-slate-50 p-2.5 md:p-3 rounded-xl border border-slate-100">
                          <p className="text-[9px] md:text-[10px] uppercase font-bold text-slate-400 mb-0.5 md:mb-1">Jam Main</p>
                          <p className="font-bold text-xs md:text-sm text-blue-600">{booking.jamMain} WIB</p>
                        </div>
                      </div>

                      {booking.squadContacts && booking.squadContacts.length > 0 && (
                        <div className="mb-4 bg-red-50 p-3 rounded-xl border border-red-100 no-print relative z-10">
                          <p className="text-[10px] uppercase font-bold text-red-500 mb-2 border-b border-red-100 pb-1">Daftar Kontak Skuad (Tagih Split Bill)</p>
                          <ul className="space-y-1.5 max-h-24 overflow-y-auto hide-scrollbar">
                            {booking.squadContacts.map((kontak, idx) => (
                              <li key={idx} className="text-[10px] font-mono text-slate-700 bg-white px-2 py-1.5 rounded-md border border-red-50 flex items-center justify-between shadow-sm">
                                <span className="truncate">{kontak}</span>
                                {kontak.includes(email) && <span className="text-[8px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded">(Kamu)</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row justify-between sm:items-end gap-2 sm:gap-0 mt-auto relative z-10">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5 md:mb-1">Total Biaya Transaksi</p>
                        <p className="text-lg md:text-xl font-black text-slate-800">Rp {booking.totalBayar.toLocaleString('id-ID')}</p>
                      </div>
                      {booking.jumlahPemainSplit > 1 && (
                        <div className="sm:text-right bg-blue-50 sm:bg-transparent p-2 sm:p-0 rounded-lg sm:rounded-none">
                          <p className="text-[9px] md:text-[10px] uppercase font-bold text-slate-500 sm:text-slate-400 mb-0.5 md:mb-1">Telah Di-Split ({booking.jumlahPemainSplit})</p>
                          <p className="text-sm font-bold text-blue-600">Rp {(booking.totalBayar / booking.jumlahPemainSplit).toLocaleString('id-ID')} /bagian</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

      ) : (

        /* --- HALAMAN BERANDA & KATALOG UTAMA --- */
        <>
          <section className="relative text-white min-h-[75vh] md:min-h-[85vh] flex items-center px-4 md:px-6 pt-10 md:pt-12 pb-16 overflow-hidden no-print z-10">
            <div className="absolute inset-0 z-0">
              <img src="https://images.unsplash.com/photo-1504450758481-7338eba7524a?auto=format&fit=crop&w=1920&q=80" alt="Stadium" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-slate-900/85 md:bg-slate-900/80"></div> 
              <div className="absolute inset-x-0 bottom-0 h-24 md:h-40 bg-gradient-to-t from-slate-50 to-transparent"></div>
            </div>
            
            <div className="max-w-6xl mx-auto w-full relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
              <div className="lg:col-span-7 text-center md:text-left pt-8 md:pt-0">
                <div className="inline-block mb-4 md:mb-6 px-3 py-1.5 rounded-full bg-slate-800/60 border border-white/10 text-blue-300 font-bold text-[9px] md:text-[10px] tracking-wider backdrop-blur-md shadow-sm">📍 KHUSUS AREA SEMARANG KOTA</div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4 md:mb-6 leading-tight drop-shadow-lg">
                  Pusat Booking & Matchmaking <br className="hidden md:block"/><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Olahraga Semarang.</span>
                </h1>
                <p className="text-sm md:text-lg text-slate-300 mb-8 md:mb-10 max-w-lg mx-auto md:mx-0 leading-relaxed drop-shadow-md">Platform eksklusif warga Semarang untuk mengecek jadwal lapangan, patungan bayar (Split Bill), hingga mencari lawan tanding secara real-time.</p>
                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center md:justify-start">
                  <a href="#katalog" onClick={handleNavKatalog} className="bg-blue-600 hover:bg-blue-500 text-white px-6 md:px-8 py-3.5 rounded-full font-bold text-xs md:text-sm transition shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center justify-center gap-2 relative z-10">🔍 Cari Lapangan</a>
                  <a href="#katalog" onClick={handleNavKatalog} className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-6 md:px-8 py-3.5 rounded-full font-bold text-xs md:text-sm transition flex items-center justify-center gap-2 relative z-10">⚔️ Cari Lawan Sparing</a>
                </div>
              </div>

              <div className="lg:col-span-5 flex flex-col gap-4 mt-4 lg:mt-0 px-2 sm:px-0">
                <div className="flex justify-between items-end mb-1 md:mb-2 px-1">
                  <h3 className="text-white font-bold text-lg md:text-xl drop-shadow-md">Update Olahraga</h3>
                </div>
                <div className="h-[300px] md:h-[380px] overflow-hidden cylinder-mask pr-1 md:pr-2 pb-4 relative z-10">
                  <div className="animate-news-scroll flex flex-col gap-3 md:gap-4">
                    {[...newsHighlights, ...newsHighlights].map((news, index) => (
                      <div key={`${news.id}-${index}`} className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-2.5 md:p-3 flex gap-3 md:gap-4 hover:bg-white/20 transition cursor-pointer group shadow-lg mx-1">
                        <div className="w-20 h-20 md:w-24 md:h-24 shrink-0 rounded-xl overflow-hidden relative">
                          <img src={news.image} alt={news.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        <div className="flex flex-col justify-center">
                          <span className="text-blue-300 text-[9px] md:text-[10px] font-bold uppercase tracking-wider mb-1 md:mb-1.5">{news.category}</span>
                          <h4 className="text-white font-bold text-xs md:text-sm leading-snug line-clamp-2 group-hover:text-blue-200 transition">{news.title}</h4>
                          <p className="text-slate-400 text-[9px] md:text-[10px] mt-1.5 md:mt-2 font-medium">📅 {news.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <main id="katalog" className="bg-slate-50 max-w-6xl mx-auto p-4 md:p-6 w-full flex-grow pt-6 md:pt-8 pb-20 no-print relative z-10">
            
            {/* ====== 1. BANNER STATISTIK ====== */}
            <div className="bg-white rounded-2xl p-6 md:p-8 mb-12 shadow-sm border border-slate-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4 text-center divide-y md:divide-y-0 md:divide-x divide-slate-100">
                <div className="pt-4 md:pt-0">
                  <p className="text-3xl md:text-4xl font-black text-slate-800 mb-1">10<span className="text-blue-500">+</span></p>
                  <p className="text-[10px] md:text-xs text-slate-500 uppercase tracking-widest font-bold">Mitra Lapangan</p>
                </div>
                <div className="pt-4 md:pt-0">
                  <p className="text-3xl md:text-4xl font-black text-slate-800 mb-1">100<span className="text-blue-500">%</span></p>
                  <p className="text-[10px] md:text-xs text-slate-500 uppercase tracking-widest font-bold">Harga Transparan</p>
                </div>
                <div className="pt-4 md:pt-0">
                  <p className="text-3xl md:text-4xl font-black text-slate-800 mb-1">150<span className="text-blue-500">+</span></p>
                  <p className="text-[10px] md:text-xs text-slate-500 uppercase tracking-widest font-bold">Skuad Mabar</p>
                </div>
                <div className="pt-4 md:pt-0">
                  <p className="text-3xl md:text-4xl font-black text-slate-800 mb-1">24<span className="text-blue-500">/</span>7</p>
                  <p className="text-[10px] md:text-xs text-slate-500 uppercase tracking-widest font-bold">Sistem Aktif</p>
                </div>
              </div>
            </div>

            {/* ====== 2. KARTU KEUNGGULAN ====== */}
            <section className="mb-12">
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800">Kenapa Pakai SportSpace?</h2>
                <p className="text-slate-500 text-xs md:text-sm mt-2">Tinggalkan cara lama. Booking lapangan kini semudah memesan tiket bioskop.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 group relative z-10 cursor-default">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">⚡</div>
                  <h3 className="font-bold text-slate-800 text-lg mb-2">Booking Instan</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">Tidak perlu lagi chat admin lapangan satu per satu. Cek jadwal kosong secara real-time dan langsung bayar via QRIS.</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-red-200 transition-all duration-300 group relative z-10 cursor-default">
                  <div className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">⚔️</div>
                  <h3 className="font-bold text-slate-800 text-lg mb-2">Smart Matchmaking</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">Susah cari lawan tanding atau kurang orang buat futsal? Gabung ke Lobby terbuka dan biarkan sistem merakit skuad Anda.</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-green-200 transition-all duration-300 group relative z-10 cursor-default">
                  <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">🤝</div>
                  <h3 className="font-bold text-slate-800 text-lg mb-2">Auto Split-Bill</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">Ucapkan selamat tinggal pada tagihan ribet. Sistem otomatis membagi rata harga lapangan sesuai jumlah orang yang patungan.</p>
                </div>
              </div>
            </section>

            {/* ====== 3. PANDUAN PENGGUNAAN ====== */}
            <section className="mb-10 md:mb-16 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-8 overflow-hidden">
              <div className="text-center mb-6 md:mb-8">
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-800">Panduan Penggunaan Matchmaking</h2>
                <p className="text-slate-500 text-[10px] md:text-xs uppercase tracking-wider mt-2 font-bold">Pilih Mode Sesuai Kebutuhan Skuad Anda</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="bg-blue-50/50 p-5 md:p-6 rounded-2xl border border-blue-100 flex flex-col hover:bg-blue-50 transition-colors">
                  <h3 className="font-bold text-blue-800 mb-4 flex items-center gap-2 text-sm md:text-base"><span className="text-lg">👤</span> Mode Cari Teman (Individu)</h3>
                  <div className="space-y-4">
                    <div className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</div>
                      <div><h4 className="font-bold text-xs md:text-sm text-slate-700 leading-none">Gabung Lobby Individu</h4><p className="text-[10px] md:text-xs text-slate-500 mt-1.5 leading-snug">Sistem otomatis menyiapkan kuota sesuai jenis olahraga (Contoh: Futsal butuh 10 orang).</p></div>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</div>
                      <div><h4 className="font-bold text-xs md:text-sm text-slate-700 leading-none">Auto-fill Kontak WA</h4><p className="text-[10px] md:text-xs text-slate-500 mt-1.5 leading-snug">Nomor WA yang tersimpan di Profil akan otomatis terisi saat mendaftar Mabar.</p></div>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</div>
                      <div><h4 className="font-bold text-xs md:text-sm text-slate-700 leading-none">Sistem Host (Penalang)</h4><p className="text-[10px] md:text-xs text-slate-500 mt-1.5 leading-snug">Orang pertama yang klik "Checkout" saat lobby penuh akan menjadi Host lapangan.</p></div>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50/50 p-5 md:p-6 rounded-2xl border border-red-100 flex flex-col hover:bg-red-50 transition-colors mt-2 md:mt-0">
                  <h3 className="font-bold text-red-800 mb-4 flex items-center gap-2 text-sm md:text-base"><span className="text-lg">🛡️</span> Mode Cari Lawan (Sparing Tim)</h3>
                  <div className="space-y-4">
                    <div className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</div>
                      <div><h4 className="font-bold text-xs md:text-sm text-slate-700 leading-none">Daftarkan Tim Anda</h4><p className="text-[10px] md:text-xs text-slate-500 mt-1.5 leading-snug">Gabung sebagai perwakilan tim. Lobby sparing HANYA muat untuk 2 Tim saja.</p></div>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</div>
                      <div><h4 className="font-bold text-xs md:text-sm text-slate-700 leading-none">Tunggu Lawan Join</h4><p className="text-[10px] md:text-xs text-slate-500 mt-1.5 leading-snug">Pantau lobby. Jika ada tim lawan yang masuk, kuota langsung penuh.</p></div>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</div>
                      <div><h4 className="font-bold text-xs md:text-sm text-slate-700 leading-none">Split Bill Antar Tim</h4><p className="text-[10px] md:text-xs text-slate-500 mt-1.5 leading-snug">Harga otomatis dibagi 2. Host menalangi dan menagih ke Kapten Lawan via WA.</p></div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <header className="mb-6 md:mb-8 flex flex-col gap-4 md:gap-5 border-b border-slate-200 pb-5 md:pb-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 md:gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-extrabold text-slate-800">Katalog & Ketersediaan</h2>
                  <p className="text-slate-500 mt-1 text-xs md:text-sm">Daftar lapangan mitra eksklusif SportSpace.</p>
                </div>
                <div className="w-full md:w-1/3 relative z-10">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-sm">🔍</span>
                  <input type="text" placeholder="Cari nama lapangan..." className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 shadow-sm text-sm font-medium bg-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full justify-start md:justify-end overflow-x-auto pb-2 md:pb-0 hide-scrollbar relative z-10">
                <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 hidden lg:block">Filter:</span>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 md:px-4 py-1.5 md:py-2 bg-white border border-slate-200 rounded-full text-[10px] md:text-xs font-bold text-slate-600 shadow-sm cursor-pointer whitespace-nowrap"><option value="Semua">Semua Status</option><option value="Tersedia">Tersedia</option><option value="Penuh">Penuh</option></select>
                <select value={filterKategori} onChange={(e) => setFilterKategori(e.target.value)} className="px-3 md:px-4 py-1.5 md:py-2 bg-white border border-slate-200 rounded-full text-[10px] md:text-xs font-bold text-slate-600 shadow-sm cursor-pointer whitespace-nowrap">{uniqueKategori.map(kat => <option key={kat} value={kat}>{kat === 'Semua' ? 'Semua Olahraga' : kat}</option>)}</select>
                <select value={filterLokasi} onChange={(e) => setFilterLokasi(e.target.value)} className="px-3 md:px-4 py-1.5 md:py-2 bg-white border border-slate-200 rounded-full text-[10px] md:text-xs font-bold text-slate-600 shadow-sm cursor-pointer max-w-[140px] md:max-w-none truncate">{uniqueLokasi.map(lok => <option key={lok} value={lok}>{lok === 'Semua' ? 'Semua Area' : lok}</option>)}</select>
              </div>
            </header>

            {loading ? (
              <div className="flex justify-center items-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600"></div></div>
            ) : filteredFields.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 opacity-60"><span className="text-3xl mb-2">🔍</span><p className="text-sm font-bold text-slate-500">Tidak ada lapangan sesuai filter.</p></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
                {filteredFields.map((field) => {
                  const maxP = getMaxPlayers(field.jenis);
                  const joinedP = field.pemainTergabung ? field.pemainTergabung.length : 0;
                  const joinedT = field.timTergabung ? field.timTergabung.length : 0;
                  
                  let statusLobbyLabel = 'Tersedia';
                  let statusColor = 'text-slate-500';
                  if (joinedP > 0 || joinedT > 0) {
                     statusColor = 'text-red-500';
                     if (joinedP >= maxP || joinedT >= 2) statusLobbyLabel = '🔥 LOBBY PENUH';
                     else statusLobbyLabel = `Ada Skuad Aktif`;
                  }

                  return (
                    <div key={field.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group relative z-10 cursor-pointer" onClick={() => handleViewDetail(field)}>
                      <div className="h-40 md:h-44 bg-slate-200 relative overflow-hidden">
                        <img src={field.image || 'https://via.placeholder.com/500'} alt={field.nama} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute top-3 right-3"><span className={`px-2 md:px-2.5 py-1 rounded-md text-[9px] md:text-[10px] font-bold shadow-sm backdrop-blur-md ${field.status === 'Tersedia' ? 'bg-green-500/90 text-white' : 'bg-slate-800/90 text-white'}`}>{field.status}</span></div>
                        <div className="absolute bottom-3 left-3"><span className="text-[8px] md:text-[9px] font-bold text-slate-800 bg-white/90 backdrop-blur-sm px-2 py-1 rounded shadow-sm uppercase">{field.jenis}</span></div>
                      </div>
                      <div className="p-3.5 md:p-4 flex flex-col flex-grow">
                        <div className="mb-3">
                          <h3 className="text-sm md:text-base font-bold text-slate-800 leading-tight truncate group-hover:text-blue-600 transition-colors">{field.nama}</h3>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-slate-500 text-[9px] md:text-[10px] truncate">📍 {field.lokasi}</p>
                            <p className="text-[9px] font-bold text-yellow-500">⭐ {getDynamicRating(field)}</p>
                          </div>
                        </div>

                        {field.isMabar && field.status === 'Tersedia' && (
                          <div className="mb-3 md:mb-4 flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100 transition-colors group-hover:bg-slate-100 relative z-10" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5 md:gap-2">
                              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-red-100 flex items-center justify-center text-[10px] md:text-xs">⚔️</div>
                              <span className={`text-[9px] md:text-[10px] font-bold ${statusColor}`}>{statusLobbyLabel}</span>
                            </div>
                            <button onClick={() => openMatchmakingModal(field)} className={`text-[8px] md:text-[9px] font-bold px-2.5 md:px-3 py-1.5 rounded-lg transition active:scale-95 shadow-sm whitespace-nowrap ${(joinedP >= maxP || joinedT >= 2) ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-red-500 text-white hover:bg-red-600'} relative z-10`}>
                              {(joinedP >= maxP || joinedT >= 2) ? 'Lanjut' : 'Cek Lobby'}
                            </button>
                          </div>
                        )}
                        
                        <div className="mt-auto pt-3 border-t border-slate-100 flex justify-between items-center gap-2 relative z-10" onClick={(e) => e.stopPropagation()}>
                          <div className="truncate">
                            <p className="text-[8px] md:text-[9px] text-slate-400 font-semibold uppercase mb-0.5">Tarif / Jam</p>
                            <p className="font-bold text-xs md:text-sm text-blue-600 truncate">Rp {field.harga ? field.harga.toLocaleString('id-ID') : '0'}</p>
                          </div>
                          
                          {userRole === 'admin' ? (
                            <button onClick={() => toggleStatusAdmin(field)} className={`px-3 md:px-4 py-1.5 rounded-full text-[9px] md:text-[10px] font-bold transition-all shadow-sm border whitespace-nowrap ${field.status === 'Tersedia' ? 'border-slate-300 text-slate-600 hover:bg-slate-50' : 'bg-green-50 border-green-500 text-green-600 hover:bg-green-100'} relative z-10`}>
                              {field.status === 'Tersedia' ? 'Tutup' : 'Buka'}
                            </button>
                          ) : (
                            <button onClick={() => openBookingModal(field, 'private')} disabled={field.status !== 'Tersedia'} className={`px-3 md:px-4 py-1.5 rounded-full text-[9px] md:text-[10px] font-bold transition-all shadow-sm whitespace-nowrap ${field.status === 'Tersedia' ? 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95' : 'bg-slate-100 text-slate-400 cursor-not-allowed'} relative z-10`}>
                              {field.status === 'Tersedia' ? 'Private Booking' : 'Penuh'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </>
      )}

      {/* FOOTER */}
      <footer className="bg-slate-900 text-slate-400 py-10 md:py-12 border-t border-slate-800 mt-auto no-print relative z-10">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-white p-1 rounded-lg"><img src="/logo.png" alt="Logo" className="h-5 md:h-6 w-auto" /></div>
              <span className="text-lg md:text-xl font-bold text-white tracking-wider">SportSpace</span>
            </div>
            <p className="leading-relaxed mb-4 text-slate-400 text-[10px] md:text-xs">Platform booking lapangan dan matchmaking olahraga #1 khusus di area Semarang Kota.</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-3 uppercase text-[10px] md:text-xs tracking-wider">Hubungi Kami</h4>
            <ul className="space-y-1.5 md:space-y-2 text-[10px] md:text-xs">
              <li>📞 WhatsApp: +62 812-3456-7890</li>
              <li>📧 Email: halo@sportspace.id</li>
              <li>📍 Gedung D, Udinus, Semarang</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-3 uppercase text-[10px] md:text-xs tracking-wider">Dikembangkan Oleh</h4>
            <p className="text-[10px] md:text-xs text-slate-300">
              SportSpace team (faza)
            </p>
          </div>
        </div>
      </footer>

      {/* --- MODAL PILIH AVATAR --- */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 md:p-8 relative border border-slate-100">
            <button onClick={() => setIsAvatarModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-lg font-bold">✖</button>
            <h3 className="text-xl font-black text-slate-800 mb-2 text-center">Pilih Avatar Karakter</h3>
            <p className="text-xs text-slate-500 mb-6 text-center">Pilih representasi visual untuk akun SportSpace Anda.</p>
            
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 max-h-60 overflow-y-auto hide-scrollbar p-1">
              {AVATARS.map((av, index) => (
                <div 
                  key={index} 
                  onClick={() => {
                    setUserProfile({...userProfile, avatar: av});
                    setIsAvatarModalOpen(false);
                    showToast("Avatar dipilih! Jangan lupa klik Simpan Profil.", "success");
                  }}
                  className={`w-full aspect-square rounded-full cursor-pointer hover:scale-110 transition-all border-4 ${userProfile.avatar === av ? 'border-blue-500 shadow-md scale-105' : 'border-transparent bg-slate-100 hover:border-blue-200'}`}
                >
                  <img src={av} alt={`Avatar ${index}`} className="w-full h-full object-cover rounded-full" />
                </div>
              ))}
            </div>
            <button onClick={() => setIsAvatarModalOpen(false)} className="w-full mt-6 py-3 bg-slate-100 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-200 transition active:scale-95">Batal</button>
          </div>
        </div>
      )}

      {/* MODAL CHECKOUT */}
      {isModalOpen && selectedField && (
        <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 md:slide-in-from-bottom-0 max-h-[90vh] overflow-y-auto">
            <div className={`${checkoutStep === 3 ? 'bg-green-600' : 'bg-slate-900'} text-white p-4 md:p-5 relative transition-colors sticky top-0 z-10`}>
              {checkoutStep !== 3 && <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-white/60 hover:text-white transition p-1">✖</button>}
              <h2 className="text-lg md:text-xl font-bold">
                {checkoutStep === 1 ? 'Pilih Jadwal Main' : checkoutStep === 2 ? 'Pembayaran QRIS' : 'Pemesanan Berhasil!'}
              </h2>
              <p className="text-white/80 text-[10px] md:text-xs mt-1">{selectedField.nama} - {selectedField.jenis}</p>
            </div>
            
            <div className="p-5 md:p-6">
              {checkoutStep === 1 && (
                <div className="animate-in fade-in slide-in-from-right-4">
                  <div className="grid grid-cols-2 gap-3 md:gap-4 mb-5 md:mb-6">
                    <div>
                      <label className="block text-[10px] md:text-xs font-bold text-slate-500 mb-1">Tanggal</label>
                      <input type="date" value={bookingDate} onChange={(e)=>setBookingDate(e.target.value)} className="w-full px-2 md:px-3 py-2 rounded-lg md:rounded-xl border border-slate-200 focus:ring-blue-500 text-xs md:text-sm font-bold text-slate-700 bg-slate-50" min={new Date().toISOString().split('T')[0]} required/>
                    </div>
                    <div>
                      <label className="block text-[10px] md:text-xs font-bold text-slate-500 mb-1">Pilih Jam</label>
                      <select value={bookingTime} onChange={(e)=>setBookingTime(e.target.value)} className="w-full px-2 md:px-3 py-2 rounded-lg md:rounded-xl border border-slate-200 focus:ring-blue-500 text-xs md:text-sm font-bold text-slate-700 bg-slate-50 cursor-pointer">
                        <option value="16:00">16:00 - 17:00</option>
                        <option value="18:00">18:00 - 19:00</option>
                        <option value="19:00">19:00 - 20:00</option>
                        <option value="20:00">20:00 - 21:00</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-3.5 md:p-4 rounded-xl md:rounded-2xl mb-5 md:mb-6 border border-blue-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-blue-900 text-[10px] md:text-xs">Split Bill ({checkoutMode === 'sparing' ? '2 Tim' : 'Bebas'})</span>
                      <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-lg md:rounded-xl px-1.5 py-0.5 shadow-sm">
                        <button onClick={() => setSplitCount(Math.max(1, splitCount - 1))} className="text-blue-600 font-black px-2 py-1 text-xs">-</button>
                        <span className="font-bold text-xs md:text-sm w-4 text-center">{splitCount}</span>
                        <button onClick={() => setSplitCount(splitCount + 1)} className="text-blue-600 font-black px-2 py-1 text-xs">+</button>
                      </div>
                    </div>
                    <div className="flex justify-between items-end mt-4">
                      <span className="text-[10px] md:text-xs font-bold text-slate-500">Total Tarif</span>
                      <span className="text-lg md:text-xl font-black text-slate-800">Rp {selectedField.harga.toLocaleString('id-ID')}</span>
                    </div>
                    {splitCount > 1 && (
                      <div className="text-right text-[10px] md:text-xs font-bold text-blue-600 mt-1">
                        Patungan: <span className="text-xs md:text-sm">Rp {(selectedField.harga / splitCount).toLocaleString('id-ID')}</span> / bagian
                      </div>
                    )}
                  </div>
                  <button onClick={() => setCheckoutStep(2)} className="w-full py-3 md:py-3.5 bg-blue-600 text-white text-xs md:text-sm font-bold rounded-xl hover:bg-blue-700 shadow-md flex justify-center gap-2">Lanjut Pembayaran &rarr;</button>
                </div>
              )}

              {checkoutStep === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4 text-center">
                  <div className="mb-4 bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col items-center">
                    <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Scan QRIS Berikut</p>
                    <div className="w-32 h-32 md:w-40 md:h-40 bg-white p-2 rounded-xl shadow-sm border border-slate-200 mb-3">
                      <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=DUMMY_QRIS_PAYMENT_SPORTSPACE" alt="QRIS" className="w-full h-full" />
                    </div>
                    <p className="text-[10px] md:text-xs text-slate-500 font-medium">Batas Waktu: <span className="text-red-500 font-bold">14:59</span></p>
                  </div>
                  <div className="flex justify-between items-center mb-5 md:mb-6 bg-blue-50 px-4 py-2.5 md:py-3 rounded-xl border border-blue-100">
                    <span className="text-xs md:text-sm font-bold text-blue-900">Total Bayar:</span>
                    <span className="text-base md:text-lg font-black text-blue-700">Rp {selectedField.harga.toLocaleString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setCheckoutStep(1)} disabled={isProcessingPayment} className="px-3 md:px-4 py-3 bg-slate-100 text-slate-600 text-[10px] md:text-xs font-bold rounded-xl hover:bg-slate-200 transition whitespace-nowrap">&larr; Kembali</button>
                    <button onClick={processPayment} disabled={isProcessingPayment} className="flex-1 py-3 bg-slate-900 text-white text-[10px] md:text-xs font-bold rounded-xl hover:bg-slate-800 transition flex justify-center items-center shadow-lg">
                      {isProcessingPayment ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Saya Sudah Bayar'}
                    </button>
                  </div>
                </div>
              )}

              {checkoutStep === 3 && (
                <div className="animate-in zoom-in-95 fade-in text-center py-4 md:py-6">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center text-3xl md:text-4xl mx-auto mb-4 border-4 border-white shadow-lg">✓</div>
                  <h3 className="text-xl md:text-2xl font-black text-slate-800 mb-1">Mantap!</h3>
                  <p className="text-xs md:text-sm text-slate-500 mb-5 md:mb-6 px-2 md:px-4">Pesanan kamu sudah masuk sistem dan sedang menunggu konfirmasi admin.</p>
                  <button onClick={() => { setIsModalOpen(false); fetchUserBookings(); }} className="w-full py-3 md:py-3.5 bg-green-500 hover:bg-green-600 text-white text-xs md:text-sm font-bold rounded-xl shadow-md transition">Lihat Tiket Saya</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DUAL MATCHMAKING (INDIVIDU VS SPARING) */}
      {isMatchmakingModalOpen && liveMatchField && (() => {
        const maxP = getMaxPlayers(liveMatchField.jenis);
        const currentPlayers = liveMatchField.pemainTergabung || [];
        const sisaSlotIndividu = Math.max(0, maxP - currentPlayers.length);
        const isJoinedIndividu = currentPlayers.some(p => p.includes(email));

        const currentTeams = liveMatchField.timTergabung || [];
        const sisaSlotSparing = Math.max(0, 2 - currentTeams.length);
        const isJoinedSparing = currentTeams.some(t => t.includes(email));

        return (
          <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 md:slide-in-from-bottom-0">
              
              <div className="bg-red-600 text-white p-4 md:p-5 relative shrink-0">
                <button onClick={() => setIsMatchmakingModalOpen(false)} className="absolute top-4 right-4 text-white/70 hover:text-white transition p-1">✖</button>
                <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">⚔️ Live Matchmaking</h2>
                <p className="text-red-100 text-[10px] md:text-xs mt-1">{liveMatchField.nama} - {liveMatchField.jenis}</p>
              </div>

              <div className="flex bg-slate-100 p-1 md:p-1.5 shrink-0 border-b border-slate-200">
                <button onClick={() => setMatchmakingTab('individu')} className={`flex-1 py-2 text-[10px] md:text-xs font-bold rounded-xl transition ${matchmakingTab === 'individu' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  👤 Cari Teman ({currentPlayers.length}/{maxP})
                </button>
                <button onClick={() => setMatchmakingTab('sparing')} className={`flex-1 py-2 text-[10px] md:text-xs font-bold rounded-xl transition ${matchmakingTab === 'sparing' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  🛡️ Sparing Tim ({currentTeams.length}/2)
                </button>
              </div>

              <div className="p-4 md:p-5 flex-grow overflow-y-auto bg-slate-50">
                
                {matchmakingTab === 'individu' && (
                  <div className="animate-in fade-in">
                    <p className="text-[10px] text-slate-500 mb-3 bg-blue-50 p-2 rounded-lg border border-blue-100">Gabung sendiri untuk mencari kawan patungan. Kuota disesuaikan dengan jenis olahraga.</p>
                    <ul className="space-y-2 md:space-y-2.5">
                      {currentPlayers.map((pemainStr, index) => {
                        const [pemainNama, pemainWA] = pemainStr.split(' | WA: ');
                        const isMe = pemainNama.includes(email);
                        return (
                          <li key={index} className="bg-white p-2 md:p-2.5 rounded-xl border border-slate-200 flex items-center gap-2.5 md:gap-3 shadow-sm">
                            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-blue-100 text-blue-600 font-bold text-[10px] md:text-xs flex items-center justify-center shrink-0">P{index + 1}</div>
                            <div className="min-w-0 flex-grow">
                              <p className="text-[9px] md:text-[10px] font-bold text-slate-800 truncate w-full">{pemainNama} {isMe && <span className="text-green-500">(Kamu)</span>}</p>
                              <p className="text-[8px] md:text-[9px] text-slate-500">WA: {pemainWA || 'Tersembunyi'}</p>
                            </div>
                          </li>
                        );
                      })}
                      {Array.from({ length: sisaSlotIndividu }).map((_, idx) => (
                        <li key={`empty-${idx}`} className="bg-slate-100/50 p-2 md:p-2.5 rounded-xl border border-dashed border-slate-300 flex items-center gap-2.5 md:gap-3">
                          <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-200 text-slate-400 font-bold text-[10px] md:text-xs flex items-center justify-center shrink-0">?</div>
                          <div><p className="text-[9px] md:text-[10px] font-bold text-slate-400">Slot Kosong</p></div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {matchmakingTab === 'sparing' && (
                  <div className="animate-in fade-in">
                    <p className="text-[10px] text-slate-500 mb-3 bg-red-50 p-2 rounded-lg border border-red-100">Gabung sebagai Tim. Hanya membutuhkan 2 Tim (Tuan Rumah VS Penantang) untuk bertanding.</p>
                    <div className="flex flex-col gap-3 relative">
                      <div className={`p-4 rounded-xl border-2 ${currentTeams[0] ? 'bg-white border-blue-200 shadow-sm' : 'bg-slate-100/50 border-dashed border-slate-300'}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Tim Tuan Rumah</span>
                        </div>
                        {currentTeams[0] ? (() => {
                          const [timNamaDanEmail, timWA] = currentTeams[0].split(' | WA: ');
                          const isMyTeam = timNamaDanEmail.includes(email);
                          return (
                            <div>
                              <p className="font-black text-blue-700 text-sm">{timNamaDanEmail.split(' (')[0]}</p>
                              <p className="text-[9px] text-slate-500">Kapten: {timNamaDanEmail.split('(')[1].replace(')','')} {isMyTeam && <span className="text-green-500 font-bold">(Kamu)</span>}</p>
                              <p className="text-[8px] bg-slate-100 inline-block px-1.5 py-0.5 rounded mt-1 font-mono text-slate-600">WA: {timWA}</p>
                            </div>
                          );
                        })() : (
                          <div className="text-center py-2"><p className="text-xs font-bold text-slate-400">Belum ada Tuan Rumah</p></div>
                        )}
                      </div>

                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-500 text-white w-8 h-8 flex items-center justify-center rounded-full font-black text-[10px] border-4 border-slate-50 z-10 shadow-sm">
                        VS
                      </div>

                      <div className={`p-4 rounded-xl border-2 ${currentTeams[1] ? 'bg-white border-red-200 shadow-sm' : 'bg-slate-100/50 border-dashed border-slate-300'}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Tim Penantang</span>
                        </div>
                        {currentTeams[1] ? (() => {
                          const [timNamaDanEmail, timWA] = currentTeams[1].split(' | WA: ');
                          const isMyTeam = timNamaDanEmail.includes(email);
                          return (
                            <div>
                              <p className="font-black text-red-600 text-sm">{timNamaDanEmail.split(' (')[0]}</p>
                              <p className="text-[9px] text-slate-500">Kapten: {timNamaDanEmail.split('(')[1].replace(')','')} {isMyTeam && <span className="text-green-500 font-bold">(Kamu)</span>}</p>
                              <p className="text-[8px] bg-slate-100 inline-block px-1.5 py-0.5 rounded mt-1 font-mono text-slate-600">WA: {timWA}</p>
                            </div>
                          );
                        })() : (
                          <div className="text-center py-2"><p className="text-xs font-bold text-slate-400">Menunggu Penantang...</p></div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-4 md:p-5 bg-white border-t border-slate-100 shrink-0">
                {matchmakingTab === 'individu' ? (
                  sisaSlotIndividu === 0 ? (
                    <button onClick={proceedToBookingFromLobby} className="w-full py-3 md:py-3.5 bg-green-500 text-white text-[10px] md:text-xs font-bold rounded-xl hover:bg-green-600 transition shadow-md shadow-green-200 animate-pulse border-2 border-green-400">
                      🔥 Kuota Penuh! Checkout Skuad (Host)
                    </button>
                  ) : isJoinedIndividu ? (
                    <div className="flex flex-col gap-2">
                      <button disabled className="w-full py-2.5 md:py-3 bg-slate-100 text-slate-500 text-[10px] md:text-xs font-bold rounded-xl border border-slate-200">
                        ⏳ Menunggu {sisaSlotIndividu} pemain lagi...
                      </button>
                      <button onClick={() => leaveMatchmaking('individu')} className="w-full py-2 text-red-500 text-[10px] md:text-xs font-bold hover:underline">
                        Batal / Keluar Skuad Individu
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => joinMatchmaking('individu')} className="w-full py-3 md:py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] md:text-xs font-bold rounded-xl shadow-md active:scale-95 flex items-center justify-center gap-2">
                      <span className="text-sm">👤</span> Gabung Skuad Mabar
                    </button>
                  )
                ) : (
                  sisaSlotSparing === 0 ? (
                    <button onClick={proceedToBookingFromLobby} className="w-full py-3 md:py-3.5 bg-green-500 text-white text-[10px] md:text-xs font-bold rounded-xl hover:bg-green-600 transition shadow-md shadow-green-200 animate-pulse border-2 border-green-400">
                      🔥 Match Ditemukan! Checkout (Host)
                    </button>
                  ) : isJoinedSparing ? (
                    <div className="flex flex-col gap-2">
                      <button disabled className="w-full py-2.5 md:py-3 bg-slate-100 text-slate-500 text-[10px] md:text-xs font-bold rounded-xl border border-slate-200">
                        ⏳ Menunggu Tim Lawan masuk...
                      </button>
                      <button onClick={() => leaveMatchmaking('sparing')} className="w-full py-2 text-red-500 text-[10px] md:text-xs font-bold hover:underline">
                        Tarik Mundur Tim (Batal Sparing)
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => joinMatchmaking('sparing')} className="w-full py-3 md:py-3.5 bg-red-500 hover:bg-red-600 text-white text-[10px] md:text-xs font-bold rounded-xl shadow-md active:scale-95 flex items-center justify-center gap-2">
                      <span className="text-sm">🛡️</span> Daftarkan Tim Sparing
                    </button>
                  )
                )}
              </div>

            </div>
          </div>
        );
      })()}

      {/* --- MODAL CUSTOM PROMPT ELEGAN --- */}
      {customPrompt.isOpen && (
        <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 md:p-8 relative text-center border border-slate-100">
            <button onClick={() => setCustomPrompt({ ...customPrompt, isOpen: false })} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-lg font-bold">✖</button>
            
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 border border-blue-100 shadow-inner">
              {customPrompt.type === 'individu' ? '👤' : '🛡️'}
            </div>
            
            <h3 className="text-xl font-black text-slate-800 mb-2">{customPrompt.title}</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed px-2">{customPrompt.desc}</p>
            
            <div className="space-y-4 text-left">
              {customPrompt.type === 'sparing' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Nama Tim / Skuad</label>
                  <input type="text" value={customPrompt.val2} onChange={(e) => setCustomPrompt({...customPrompt, val2: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 bg-slate-50 text-sm font-bold text-slate-800 placeholder-slate-400" placeholder="Misal: FC Udinus" autoFocus />
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Nomor WA (Untuk Split Bill)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">📞</span>
                  <input type="number" value={customPrompt.val1} onChange={(e) => setCustomPrompt({...customPrompt, val1: e.target.value})} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 bg-slate-50 text-sm font-bold text-slate-800 placeholder-slate-400" placeholder="0812xxxx" />
                </div>
              </div>
            </div>

            <button onClick={() => customPrompt.onConfirm(customPrompt.val1, customPrompt.val2)} className="w-full mt-6 py-3.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-200 active:scale-95">
              Simpan & Lanjutkan
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;