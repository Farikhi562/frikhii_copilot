import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Language = "en" | "id";

const STORAGE_KEY = "frikhii.language";

type I18nValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (text: string) => string;
};

const fallback: I18nValue = {
  language: "en",
  setLanguage: () => undefined,
  toggleLanguage: () => undefined,
  t: (text) => text,
};

const I18nContext = createContext<I18nValue | null>(null);

const normalize = (value: string) =>
  value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00b7/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/**
 * Indonesian copy keyed by the English source string. The DOM translator
 * normalises whitespace, case and curly punctuation before lookup, so this
 * stays easy to extend without touching every component.
 */
const indonesian: Record<string, string> = {
  // Global / navigation
  "product": "Produk",
  "course architect": "Arsitek Kursus",
  "how it works": "Cara Kerja",
  "faq": "FAQ",
  "sign in": "Masuk",
  "sign out": "Keluar",
  "signing in...": "Sedang masuk...",
  "signing out...": "Sedang keluar...",
  "get started": "Mulai",
  "back to home": "Kembali ke beranda",
  "back to sign in": "Kembali ke halaman masuk",
  "home": "Beranda",
  "dashboard": "Dasbor",
  "courses": "Kursus",
  "settings": "Pengaturan",
  "account": "Akun",
  "account settings": "Pengaturan akun",
  "account menu": "Menu akun",
  "menu": "Menu",
  "navigate the app or manage your account.": "Jelajahi aplikasi atau kelola akunmu.",
  "phase 03": "Fase 03",
  "main": "Utama",
  "mobile": "Seluler",
  "loading course": "Memuat kursus",
  "try again": "Coba lagi",
  "not provided": "Belum diisi",
  "no deadline": "Tanpa tenggat",
  "unknown": "Tidak diketahui",
  "sample": "contoh",

  // Language selector
  "language": "Bahasa",
  "english": "English",
  "bahasa indonesia": "Bahasa Indonesia",
  "choose language": "Pilih bahasa",

  // Landing: nav + hero
  "frikhii copilot, back to top": "FRIKHII Copilot, kembali ke atas",
  "close menu": "Tutup menu",
  "open menu": "Buka menu",
  "course overview": "Ringkasan kursus",
  "demo - sample data": "Demo - data contoh",
  "current course": "Kursus saat ini",
  "data science foundations": "Dasar-Dasar Data Science",
  "modules reviewed (sample)": "modul ditinjau (contoh)",
  "ai tutor - scripted example": "Tutor AI - contoh terskrip",
  "why does a line of best fit minimise squared error instead of absolute error?":
    "Mengapa garis best fit meminimalkan error kuadrat, bukan error absolut?",
  "squared error punishes large misses more and gives one smooth solution. try predicting the fit for three points.":
    "Error kuadrat lebih menghukum kesalahan besar dan memberikan satu solusi yang mulus. Coba prediksi garis untuk tiga titik.",
  "product demonstration. sample data, not a live account. the ai tutor is planned.":
    "Demonstrasi produk. Data contoh, bukan akun langsung. Tutor AI masih direncanakan.",
  "frikhii copilot - personal ai learning companion":
    "FRIKHII Copilot - Pendamping belajar AI personal",
  "your ambition deserves a better way to learn.":
    "Ambisimu layak mendapatkan cara belajar yang lebih baik.",
  "turn your learning goals into structured courses, guided lessons, and measurable progress with your personal ai learning companion.":
    "Ubah tujuan belajarmu menjadi kursus terstruktur, pelajaran terpandu, dan progres yang terukur bersama pendamping belajar AI personal.",
  "start learning": "Mulai Belajar",
  "explore the product": "Jelajahi Produk",
  "learning roadmap": "Peta belajar",
  "foundations": "Fondasi",
  "data work": "Pengolahan Data",
  "modelling": "Pemodelan",
  "completed": "Selesai",
  "in progress": "Sedang Berjalan",
  "upcoming": "Akan Datang",
  "product demonstration with sample data": "Demonstrasi produk dengan data contoh",

  // Landing: problem + solution
  "the problem": "Masalahnya",
  "learning without direction is just browsing.":
    "Belajar tanpa arah hanyalah menjelajah.",
  "people have access to countless learning resources but often lack structure, direction, and a way to measure real understanding.":
    "Banyak orang punya akses ke sumber belajar yang tak terhitung, tetapi sering kurang struktur, arah, dan cara mengukur pemahaman yang sebenarnya.",
  "no roadmap to follow.": "Tidak ada peta yang bisa diikuti.",
  "material scattered across dozens of places.":
    "Materi tersebar di puluhan tempat.",
  "concepts that never quite click.": "Konsep yang tak pernah benar-benar dipahami.",
  "no evaluation of what you actually know.":
    "Tidak ada evaluasi atas apa yang benar-benar kamu kuasai.",
  "no idea which skills to strengthen next.":
    "Tidak tahu keterampilan mana yang harus diperkuat berikutnya.",
  "the solution": "Solusinya",
  "goals become personalized learning journeys.":
    "Tujuan berubah menjadi perjalanan belajar yang personal.",
  "frikhii copilot turns what you want to achieve into a structured path, rather than a pile of resources.":
    "FRIKHII Copilot mengubah apa yang ingin kamu capai menjadi jalur terstruktur, bukan tumpukan sumber belajar.",
  "understand": "Pahami",
  "clarify the goal and where you start.":
    "Perjelas tujuan dan titik awalmu.",
  "explain": "Jelaskan",
  "learn each concept in a structured order.":
    "Pelajari setiap konsep dalam urutan terstruktur.",
  "practice": "Latihan",
  "apply it with focused exercises.": "Terapkan lewat latihan yang terfokus.",
  "evaluate": "Evaluasi",
  "check what you actually understood.": "Periksa apa yang benar-benar kamu pahami.",
  "master": "Kuasai",
  "build capability you can demonstrate.":
    "Bangun kemampuan yang bisa kamu tunjukkan.",
  "the learning loop frikhii copilot is designed around. practice, evaluation and mastery tracking are planned.":
    "Siklus belajar yang menjadi dasar rancangan FRIKHII Copilot. Latihan, evaluasi, dan pelacakan penguasaan masih direncanakan.",

  // Landing: architect
  "ai course architect": "Arsitek Kursus AI",
  "from a goal to a curriculum you can review.":
    "Dari sebuah tujuan menjadi kurikulum yang bisa kamu tinjau.",
  "describe a goal in your own words. get a structured curriculum shaped by your starting knowledge, which you can edit before approving.":
    "Jelaskan tujuanmu dengan kata-katamu sendiri. Dapatkan kurikulum terstruktur yang dibentuk dari pengetahuan awalmu, dan bisa kamu edit sebelum disetujui.",
  "learning goal": "Tujuan belajar",
  "describe what you want to learn, why, and how much time you have.":
    "Jelaskan apa yang ingin kamu pelajari, mengapa, dan berapa banyak waktu yang kamu punya.",
  "i want to become a data scientist in a year.":
    "Saya ingin menjadi data scientist dalam satu tahun.",
  "knowledge diagnosis": "Diagnosis pengetahuan",
  "a short diagnostic estimates your starting point and gaps.":
    "Diagnostik singkat memperkirakan titik awal dan celah pengetahuanmu.",
  "which error does least squares minimise?":
    "Error mana yang diminimalkan oleh metode least squares?",
  "absolute": "Absolut",
  "squared": "Kuadrat",
  "not sure": "Belum yakin",
  "curriculum": "Kurikulum",
  "a structured draft of modules, classes and lesson blueprints to review.":
    "Draf terstruktur berisi modul, kelas, dan kerangka pelajaran untuk ditinjau.",
  "module 01 - foundations": "Modul 01 - Fondasi",
  "class 01 - python basics": "Kelas 01 - Dasar Python",
  "class 02 - data structures": "Kelas 02 - Struktur Data",
  "module 02 - data work": "Modul 02 - Pengolahan Data",
  "edit, regenerate or approve it, then it becomes your course.":
    "Edit, buat ulang, atau setujui, lalu draf itu menjadi kursusmu.",
  "class 01 is your starting class; later classes are upcoming.":
    "Kelas 01 adalah titik awalmu; kelas berikutnya akan datang.",
  "illustrative example. real curricula are generated from your own goal and diagnostic, and ai output can contain mistakes.":
    "Contoh ilustrasi. Kurikulum nyata dihasilkan dari tujuan dan diagnostikmu, dan keluaran AI bisa mengandung kesalahan.",
  "create your first goal": "Buat tujuan pertamamu",

  // Landing: tutor
  "ai personal tutor": "Tutor AI Personal",
  "one companion, six ways to learn.":
    "Satu pendamping, enam cara belajar.",
  "deep dive": "Pendalaman",
  "go further into the reasoning behind an idea.":
    "Telusuri lebih jauh alasan di balik sebuah gagasan.",
  "clear explanations of a concept, matched to your level.":
    "Penjelasan konsep yang jelas, disesuaikan dengan levelmu.",
  "focused exercises on what you are learning.":
    "Latihan terfokus pada apa yang sedang kamu pelajari.",
  "socratic": "Sokratik",
  "guiding questions that help you reach the answer yourself.":
    "Pertanyaan pemandu yang membantumu menemukan jawabannya sendiri.",
  "review": "Ulasan",
  "revisit and consolidate earlier material.":
    "Kunjungi kembali dan perkuat materi sebelumnya.",
  "project": "Proyek",
  "apply skills to a realistic, goal-relevant project.":
    "Terapkan keterampilan pada proyek nyata yang relevan dengan tujuanmu.",
  "learning modes": "Mode belajar",
  "mode -": "Mode -",
  "squared error punishes large misses more and gives one smooth solution. which error type is less sensitive to outliers?":
    "Error kuadrat lebih menghukum kesalahan besar dan memberikan satu solusi yang mulus. Jenis error mana yang kurang sensitif terhadap outlier?",
  "scripted demonstration. the ai personal tutor is planned and not yet available.":
    "Demonstrasi terskrip. Tutor AI Personal masih direncanakan dan belum tersedia.",

  // Landing: showcase
  "product interface": "Antarmuka produk",
  "a look at the learning workspace.": "Sekilas ruang belajar.",
  "concept previews built from the same interface components as the product. each one says whether it exists today.":
    "Pratinjau konsep yang dibangun dari komponen antarmuka yang sama dengan produk. Setiap pratinjau menyatakan apakah fiturnya sudah ada.",
  "estimated duration": "Estimasi durasi",
  "~60 h": "~60 jam",
  "class 03 - data cleaning": "Kelas 03 - Pembersihan Data",
  "start here": "Mulai di sini",
  "lesson workspace": "Ruang pelajaran",
  "assessment": "Asesmen",
  "progress analytics": "Analitik progres",
  "accuracy": "Akurasi",
  "f1 score": "Skor F1",
  "which metric suits an imbalanced dataset?":
    "Metrik mana yang cocok untuk dataset tidak seimbang?",
  "sample data for illustration. previews marked planned are concepts, not available features.":
    "Data contoh untuk ilustrasi. Pratinjau bertanda Direncanakan adalah konsep, bukan fitur yang sudah tersedia.",

  // Landing: how / why / closing
  "define your ambition": "Tentukan ambisimu",
  "say what you want to learn and what you want to be able to do.":
    "Katakan apa yang ingin kamu pelajari dan apa yang ingin kamu mampu lakukan.",
  "discover your starting point": "Temukan titik awalmu",
  "answer a short diagnostic so the plan fits what you already know.":
    "Jawab diagnostik singkat agar rencana sesuai dengan yang sudah kamu kuasai.",
  "build your personalized curriculum": "Bangun kurikulum personalmu",
  "review, edit and approve a structured course draft.":
    "Tinjau, edit, dan setujui draf kursus yang terstruktur.",
  "learn, practice, and grow": "Belajar, berlatih, dan berkembang",
  "guided lessons, practice and evaluation follow the plan.":
    "Pelajaran terpandu, latihan, dan evaluasi mengikuti rencana.",
  "learn with intent.": "Belajar dengan niat.",
  "why frikhii": "Mengapa FRIKHII",
  "built around understanding, not content.":
    "Dibangun untuk pemahaman, bukan sekadar konten.",
  "a learning companion is only useful if it gives your effort a direction and a way to check it.":
    "Pendamping belajar hanya berguna jika memberi arah pada usahamu dan cara untuk memeriksanya.",
  "structured learning instead of isolated conversations":
    "Belajar terstruktur, bukan percakapan terpisah-pisah",
  "courses, modules and classes give every session a place in a larger plan.":
    "Kursus, modul, dan kelas memberi setiap sesi tempat dalam rencana yang lebih besar.",
  "personalized learning paths": "Jalur belajar personal",
  "your goal, starting knowledge and available time shape the curriculum.":
    "Tujuan, pengetahuan awal, dan waktu yang tersedia membentuk kurikulum.",
  "learning objectives tied to competencies":
    "Tujuan belajar yang terhubung dengan kompetensi",
  "each class states what you should be able to do, and which competency it serves.":
    "Setiap kelas menyatakan apa yang seharusnya bisa kamu lakukan dan kompetensi apa yang dilatih.",
  "practice and evaluation": "Latihan dan evaluasi",
  "exercises and knowledge checks are planned for every class, with real assessment to follow.":
    "Latihan dan cek pengetahuan direncanakan untuk setiap kelas, disusul asesmen nyata.",
  "progress designed around understanding":
    "Progres dirancang berdasarkan pemahaman",
  "progress is meant to reflect what you understand, not how much content you opened.":
    "Progres seharusnya mencerminkan pemahamanmu, bukan seberapa banyak konten yang kamu buka.",
  "learn with intent. become capable.": "Belajar dengan niat. Jadi mampu.",
  "your next chapter starts with what you choose to learn.":
    "Bab berikutnya dimulai dari apa yang kamu pilih untuk dipelajari.",
  "start with an ambition. build the knowledge, skills, and confidence to make it real.":
    "Mulai dari ambisi. Bangun pengetahuan, keterampilan, dan keyakinan untuk mewujudkannya.",
  "frikhii copilot is a personal ai learning companion that turns learning goals into structured, reviewable courses.":
    "FRIKHII Copilot adalah pendamping belajar AI personal yang mengubah tujuan belajar menjadi kursus terstruktur yang bisa ditinjau.",
  "frikhii copilot trailer": "Trailer FRIKHII Copilot",
  "a short look at how frikhii turns a goal into a learning journey.":
    "Sekilas tentang bagaimana FRIKHII mengubah tujuan menjadi perjalanan belajar.",
  "all rights reserved.": "Hak cipta dilindungi.",
  "frikhii. all rights reserved.": "FRIKHII. Hak cipta dilindungi.",
  "legal": "Legal",
  "privacy": "Privasi",
  "terms": "Ketentuan",
  "contact": "Kontak",
  "an independent product. not an official universitas gunadarma platform.":
    "Produk independen. Bukan platform resmi Universitas Gunadarma.",
  "product trailer": "Trailer produk",
  "meet your new learning companion.": "Kenali pendamping belajar barumu.",
  "trailer coming soon": "Trailer segera hadir",

  // FAQ
  "built, in testing": "Sudah dibangun, sedang diuji",
  "works in this build. still being verified end to end.":
    "Berfungsi di versi ini. Masih diverifikasi menyeluruh.",
  "partly built": "Sebagian sudah dibangun",
  "some of it works today. the rest is on the roadmap.":
    "Sebagian sudah berfungsi. Sisanya masih dalam rencana.",
  "planned": "Direncanakan",
  "on the roadmap. not available yet.": "Masih dalam rencana. Belum tersedia.",
  "what is frikhii copilot?": "Apa itu FRIKHII Copilot?",
  "frikhii copilot is a personal ai learning companion designed to transform learning goals into structured learning journeys, personalized courses, guided lessons, and measurable progress.":
    "FRIKHII Copilot adalah pendamping belajar AI personal yang dirancang untuk mengubah tujuan belajar menjadi perjalanan belajar terstruktur, kursus personal, pelajaran terpandu, dan progres yang terukur.",
  "today you can set a learning goal, take a short diagnostic and review a proposed curriculum. guided lessons and measurable progress are planned, not yet available.":
    "Saat ini kamu bisa menetapkan tujuan belajar, mengikuti diagnostik singkat, dan meninjau usulan kurikulum. Pelajaran terpandu dan progres terukur masih direncanakan.",
  "how does frikhii copilot work?": "Bagaimana cara kerja FRIKHII Copilot?",
  "users describe what they want to learn. the system analyzes their starting knowledge, proposes a learning curriculum, and guides them through a structured learning journey.":
    "Pengguna menjelaskan apa yang ingin dipelajari. Sistem menganalisis pengetahuan awal, mengusulkan kurikulum, lalu memandu melalui perjalanan belajar terstruktur.",
  "describing your goal, a diagnostic of your starting knowledge and a curriculum proposal are built. the guided journey that follows is planned.":
    "Menjelaskan tujuan, diagnostik pengetahuan awal, dan usulan kurikulum sudah dibangun. Perjalanan terpandu setelahnya masih direncanakan.",
  "can i use frikhii copilot as a complete beginner?":
    "Bisakah saya memakai FRIKHII Copilot sebagai pemula total?",
  "yes. the learning journey is designed to adapt to the user's current knowledge and build foundational understanding before progressing to more advanced topics.":
    "Bisa. Perjalanan belajar dirancang menyesuaikan pengetahuan saat ini dan membangun pemahaman dasar sebelum ke topik lanjutan.",
  "your self-reported level is treated as an estimate and checked with a short diagnostic before a curriculum is proposed. the lessons themselves are planned.":
    "Level yang kamu laporkan dianggap perkiraan dan dicek lewat diagnostik singkat sebelum kurikulum diusulkan. Pelajarannya sendiri masih direncanakan.",
  "how is frikhii copilot different from a regular ai chatbot?":
    "Apa bedanya FRIKHII Copilot dengan chatbot AI biasa?",
  "instead of only answering individual questions, frikhii copilot is designed around structured courses, learning objectives, practice, assessment, and continuous progress.":
    "Alih-alih hanya menjawab pertanyaan satu per satu, FRIKHII Copilot dirancang untuk kursus terstruktur, tujuan belajar, latihan, asesmen, dan progres berkelanjutan.",
  "structured courses, learning objectives, practice plans and the diagnostic are built. interactive practice, assessment, an ai tutor and progress tracking are planned.":
    "Kursus terstruktur, tujuan belajar, rencana latihan, dan diagnostik sudah dibangun. Latihan interaktif, asesmen, tutor AI, dan pelacakan progres masih direncanakan.",
  "can i customize an ai-generated curriculum?":
    "Bisakah saya menyesuaikan kurikulum buatan AI?",
  "the intended experience allows learners to review, refine, and approve their proposed curriculum before starting their learning journey.":
    "Pengalaman yang dirancang memungkinkan pelajar meninjau, menyempurnakan, dan menyetujui usulan kurikulum sebelum memulai perjalanan belajar.",
  "you can edit the course title, description, and module and class names, request a new draft with extra instructions, and approve it before it appears in your courses. a new draft never overwrites a version you have approved.":
    "Kamu bisa mengedit judul kursus, deskripsi, serta nama modul dan kelas, meminta draf baru dengan instruksi tambahan, dan menyetujuinya sebelum muncul di kursusmu. Draf baru tidak pernah menimpa versi yang sudah disetujui.",
  "does frikhii copilot replace lecturers or human mentors?":
    "Apakah FRIKHII Copilot menggantikan dosen atau mentor manusia?",
  "no. it is designed as a learning companion that supports independent study and helps learners prepare better questions, strengthen understanding, and practice their skills.":
    "Tidak. FRIKHII Copilot dirancang sebagai pendamping belajar yang mendukung studi mandiri dan membantu menyiapkan pertanyaan yang lebih baik, memperkuat pemahaman, serta melatih keterampilan.",
  "is frikhii copilot officially affiliated with universitas gunadarma?":
    "Apakah FRIKHII Copilot resmi berafiliasi dengan Universitas Gunadarma?",
  "no. frikhii copilot is an independent product and is not an official universitas gunadarma platform or partnership.":
    "Tidak. FRIKHII Copilot adalah produk independen dan bukan platform atau kemitraan resmi Universitas Gunadarma.",
  "no university systems are connected to frikhii copilot.":
    "Tidak ada sistem universitas yang terhubung ke FRIKHII Copilot.",
  "can ai-generated learning content always be trusted?":
    "Apakah konten belajar buatan AI selalu bisa dipercaya?",
  "ai-generated content can contain mistakes or incomplete explanations. learners should critically evaluate important information and verify relevant facts using reliable sources.":
    "Konten buatan AI bisa mengandung kesalahan atau penjelasan yang belum lengkap. Pelajar sebaiknya mengevaluasi informasi penting secara kritis dan memverifikasi fakta dengan sumber tepercaya.",
  "generated curricula are checked for structure and consistency, not for factual accuracy. output that looks like a url or citation is rejected, and where a source would help you get a suggested search topic instead.":
    "Kurikulum yang dihasilkan diperiksa struktur dan konsistensinya, bukan akurasi faktanya. Keluaran yang terlihat seperti URL atau sitasi ditolak; jika sumber akan membantu, kamu akan mendapat saran topik pencarian.",

  // Auth
  "welcome back.": "Selamat datang kembali.",
  "sign in to continue your learning journey.":
    "Masuk untuk melanjutkan perjalanan belajarmu.",
  "new to frikhii?": "Baru di FRIKHII?",
  "create an account": "Buat akun",
  "email": "Email",
  "password": "Kata sandi",
  "forgot password?": "Lupa kata sandi?",
  "you@example.com": "kamu@example.com",
  "create your account.": "Buat akunmu.",
  "one account for your goals, courses and progress.":
    "Satu akun untuk tujuan, kursus, dan progresmu.",
  "already have an account?": "Sudah punya akun?",
  "full name": "Nama lengkap",
  "your name": "Namamu",
  "at least 8 characters, including a letter and a number.":
    "Minimal 8 karakter, termasuk satu huruf dan satu angka.",
  "confirm password": "Konfirmasi kata sandi",
  "creating account...": "Membuat akun...",
  "create account": "Buat akun",
  "by creating an account you agree to the planned privacy policy and terms. this pilot stores only your name, email and learning preferences.":
    "Dengan membuat akun, kamu menyetujui kebijakan privasi dan ketentuan yang direncanakan. Pilot ini hanya menyimpan nama, email, dan preferensi belajarmu.",
  "check your email.": "Cek emailmu.",
  "confirm your address to activate your account.":
    "Konfirmasi alamat email untuk mengaktifkan akun.",
  "confirmation link sent": "Tautan konfirmasi terkirim",
  "we sent a confirmation link to": "Kami mengirim tautan konfirmasi ke",
  "open it in this browser, then come back to sign in.":
    "Buka tautan itu di browser ini, lalu kembali untuk masuk.",
  "no email yet? wait a minute, check your spam folder, then resend.":
    "Belum ada email? Tunggu sebentar, cek folder spam, lalu kirim ulang.",
  "sent": "Terkirim",
  "confirmation email sent again. check your inbox and spam folder.":
    "Email konfirmasi dikirim ulang. Cek kotak masuk dan folder spam.",
  "resend confirmation email": "Kirim ulang email konfirmasi",
  "go to sign in": "Ke halaman masuk",
  "forgot your password?": "Lupa kata sandi?",
  "we will email you a secure link to choose a new password.":
    "Kami akan mengirim tautan aman untuk memilih kata sandi baru.",
  "send reset link": "Kirim tautan reset",
  "sending...": "Mengirim...",
  "reset link sent": "Tautan reset terkirim",
  "check": "Cek",
  "for a link to choose a new password.": "untuk tautan memilih kata sandi baru.",
  "remembered it?": "Sudah ingat?",
  "choose a new password.": "Pilih kata sandi baru.",
  "new password": "Kata sandi baru",
  "repeat your password.": "Ulangi kata sandi.",
  "update password": "Perbarui kata sandi",
  "password updated.": "Kata sandi diperbarui.",
  "verifying your secure link...": "Memverifikasi tautan amanmu...",
  "verifying your reset link...": "Memverifikasi tautan resetmu...",
  "auth callback": "Callback autentikasi",
  "authentication is not connected yet": "Autentikasi belum terhubung",

  // Auth / validation errors
  "something went wrong. try again.": "Terjadi kesalahan. Coba lagi.",
  "the email or password is incorrect.": "Email atau kata sandi salah.",
  "confirm your email address before signing in. check your inbox for the confirmation link.":
    "Konfirmasi alamat email sebelum masuk. Cek kotak masuk untuk tautan konfirmasi.",
  "an account with this email already exists. try signing in instead.":
    "Akun dengan email ini sudah ada. Coba masuk saja.",
  "choose a stronger password with at least 8 characters, a letter and a number.":
    "Pilih kata sandi yang lebih kuat, minimal 8 karakter, dengan huruf dan angka.",
  "choose a password you have not used for this account.":
    "Pilih kata sandi yang belum pernah dipakai untuk akun ini.",
  "too many attempts. wait a minute and try again.":
    "Terlalu banyak percobaan. Tunggu satu menit lalu coba lagi.",
  "this link has expired. request a new one.":
    "Tautan ini sudah kedaluwarsa. Minta tautan baru.",
  "your account was created but the profile could not be set up. try signing in; if this continues, contact support.":
    "Akunmu dibuat tetapi profil gagal disiapkan. Coba masuk; jika masih terjadi, hubungi dukungan.",
  "authentication failed. try again.": "Autentikasi gagal. Coba lagi.",
  "enter your email address.": "Masukkan alamat email.",
  "email is too long.": "Email terlalu panjang.",
  "enter a valid email address.": "Masukkan alamat email yang valid.",
  "use at least 8 characters.": "Gunakan minimal 8 karakter.",
  "use 72 characters or fewer.": "Gunakan maksimal 72 karakter.",
  "include at least one letter.": "Sertakan minimal satu huruf.",
  "include at least one number.": "Sertakan minimal satu angka.",
  "enter your password.": "Masukkan kata sandi.",
  "password is too long.": "Kata sandi terlalu panjang.",
  "enter your full name.": "Masukkan nama lengkap.",
  "keep your name under 120 characters.": "Nama maksimal 120 karakter.",
  "passwords do not match.": "Kata sandi tidak cocok.",
  "use at least 3 characters.": "Gunakan minimal 3 karakter.",
  "keep the title under 160 characters.": "Judul maksimal 160 karakter.",
  "describe the goal in at least 8 characters.":
    "Jelaskan tujuan minimal 8 karakter.",
  "keep the goal under 2000 characters.": "Tujuan maksimal 2000 karakter.",
  "describe the outcome in at least 8 characters.":
    "Jelaskan hasil yang diinginkan minimal 8 karakter.",
  "keep the outcome under 2000 characters.": "Hasil maksimal 2000 karakter.",
  "add a short reason.": "Tambahkan alasan singkat.",
  "keep the reason under 1500 characters.": "Alasan maksimal 1500 karakter.",
  "keep this under 2000 characters.": "Maksimal 2000 karakter.",
  "keep this under 1000 characters.": "Maksimal 1000 karakter.",
  "enter the weekly minutes as a number.":
    "Masukkan menit belajar mingguan sebagai angka.",
  "use whole minutes.": "Gunakan menit bulat.",
  "plan at least 30 minutes per week.": "Rencanakan minimal 30 menit per minggu.",
  "that is more minutes than a week contains.":
    "Jumlah menit melebihi total menit dalam seminggu.",
  "choose at least one format.": "Pilih minimal satu format.",
  "keep this under 4000 characters.": "Maksimal 4000 karakter.",
  "use yyyy-mm-dd.": "Gunakan format YYYY-MM-DD.",

  // App: dashboard / courses / status
  "your goals, drafts and enrolled curricula.":
    "Tujuan, draf, dan kurikulum yang sudah kamu ikuti.",
  "learning goals": "Tujuan belajar",
  "most recent goal": "Tujuan terbaru",
  "every goal, its real status, and the next action.":
    "Setiap tujuan, status sebenarnya, dan langkah berikutnya.",
  "start with a learning goal": "Mulai dengan tujuan belajar",
  "open your enrolled curriculum or review a draft.":
    "Buka kurikulum yang sudah diikuti atau tinjau draf.",
  "drafted curricula appear here.": "Kurikulum yang dibuat akan muncul di sini.",
  "no courses yet. complete a diagnostic to generate your first draft.":
    "Belum ada kursus. Selesaikan diagnostik untuk membuat draf pertamamu.",
  "some dashboard data could not be loaded":
    "Sebagian data dasbor tidak bisa dimuat",
  "continue course": "Lanjutkan kursus",
  "review draft": "Tinjau draf",
  "view generation": "Lihat proses pembuatan",
  "retry generation": "Coba lagi pembuatan",
  "retry diagnostic": "Coba lagi diagnostik",
  "open diagnostic": "Buka diagnostik",
  "my courses": "Kursus saya",
  "personalized curricula generated from your learning goals.":
    "Kurikulum personal yang dihasilkan dari tujuan belajarmu.",
  "could not load your courses": "Gagal memuat kursusmu",
  "you have drafts waiting": "Ada draf yang menunggu",
  "intake": "Pengisian awal",
  "diagnostic ready": "Diagnostik siap",
  "diagnostic complete": "Diagnostik selesai",
  "generating": "Sedang dibuat",
  "draft review": "Tinjau draf",
  "enrolled": "Sudah diikuti",
  "needs retry": "Perlu dicoba lagi",
  "draft": "Draf",
  "approved": "Disetujui",
  "superseded": "Digantikan",
  "no version": "Belum ada versi",
  "new draft": "Draf baru",
  "modules": "Modul",
  "classes": "Kelas",
  "lessons": "Pelajaran",
  "exercises": "Latihan",
  "open course": "Buka kursus",
  "remains the enrolled curriculum": "tetap menjadi kurikulum yang diikuti",
  "development provider used": "Provider pengembangan digunakan",
  "this curriculum was generated by the deterministic mock provider, not a live language model. it is useful for exercising the flow, but the content is not personalized by an ai provider. mock generation is rejected in production.":
    "Kurikulum ini dihasilkan oleh provider mock deterministik, bukan model bahasa langsung. Berguna untuk menguji alur, tetapi kontennya tidak dipersonalisasi oleh provider AI. Pembuatan mock ditolak di produksi.",
  "fallback provider used": "Provider cadangan digunakan",
  "the primary model did not complete this request, so the configured fallback provider was used.":
    "Model utama tidak menyelesaikan permintaan ini, jadi provider cadangan yang dikonfigurasi digunakan.",
  "generated with": "Dihasilkan dengan",
  "output repaired by the validator": "keluaran diperbaiki oleh validator",

  // App: new course
  "turn a goal into a course.": "Ubah tujuan menjadi kursus.",
  "tell us what you want to achieve. a short diagnostic checks your starting point, then the architect drafts a curriculum you can review before anything is enrolled.":
    "Ceritakan apa yang ingin kamu capai. Diagnostik singkat memeriksa titik awalmu, lalu arsitek menyusun kurikulum yang bisa kamu tinjau sebelum apa pun diikuti.",
  "intake progress": "Progres pengisian",
  "step": "Langkah",
  "the goal": "Tujuan",
  "what do you want to be able to do, and why now?":
    "Apa yang ingin kamu mampu lakukan, dan mengapa sekarang?",
  "where you are": "Posisimu sekarang",
  "an honest starting point makes the diagnostic and curriculum more useful.":
    "Titik awal yang jujur membuat diagnostik dan kurikulum lebih berguna.",
  "time and constraints": "Waktu dan batasan",
  "the plan must fit your real week.": "Rencana harus cocok dengan mingguanmu yang nyata.",
  "check the details before the diagnostic.": "Periksa detail sebelum diagnostik.",
  "course title": "Judul kursus",
  "e.g. build production go services": "mis. Membangun layanan Go untuk produksi",
  "what is the goal?": "Apa tujuannya?",
  "describe what you want to be able to do. be specific about the real-world result.":
    "Jelaskan apa yang ingin kamu mampu lakukan. Spesifik tentang hasil nyata yang diinginkan.",
  "what will success look like?": "Seperti apa keberhasilannya?",
  "e.g. i can design, build, test and deploy a small api on my own.":
    "mis. Saya bisa merancang, membangun, menguji, dan men-deploy API kecil sendiri.",
  "why now?": "Mengapa sekarang?",
  "e.g. i am moving into a backend role next quarter.":
    "mis. Saya pindah ke peran backend kuartal depan.",
  "how would you describe your current level?":
    "Bagaimana kamu menggambarkan levelmu saat ini?",
  "relevant experience": "Pengalaman relevan",
  "courses, projects, jobs, or anything you have already tried. it is fine to have none.":
    "Kursus, proyek, pekerjaan, atau apa pun yang sudah pernah dicoba. Tidak punya pun tidak masalah.",
  "topics you already know": "Topik yang sudah kamu kuasai",
  "comma-separated, e.g. variables, functions, basic sql":
    "Pisahkan dengan koma, mis. variabel, fungsi, SQL dasar",
  "how confident do you feel?": "Seberapa yakin kamu?",
  "i am not sure yet": "Belum yakin",
  "beginner - new to the topic": "Pemula - baru dengan topik ini",
  "basic - i know some pieces": "Dasar - saya tahu sebagian",
  "intermediate - i can build small things": "Menengah - saya bisa membuat hal kecil",
  "advanced - i want depth and polish": "Lanjutan - saya ingin mendalami dan menyempurnakan",
  "starting from scratch": "Mulai dari nol",
  "i have some foundation": "Saya punya sedikit dasar",
  "i am comfortable with the basics": "Saya nyaman dengan dasar-dasarnya",
  "weekly study time (minutes)": "Waktu belajar mingguan (menit)",
  "learning language": "Bahasa belajar",
  "preferred formats": "Format yang disukai",
  "clear explanations": "Penjelasan jelas",
  "worked examples": "Contoh yang dikerjakan",
  "guided practice": "Latihan terpandu",
  "projects": "Proyek",
  "learning preferences": "Preferensi belajar",
  "anything that helps you learn: short sessions, more practice, no videos, etc.":
    "Apa pun yang membantumu belajar: sesi singkat, lebih banyak latihan, tanpa video, dll.",
  "constraints or extra context": "Batasan atau konteks tambahan",
  "equipment, accessibility needs, topics to avoid, or a deadline.":
    "Peralatan, kebutuhan aksesibilitas, topik yang dihindari, atau tenggat.",
  "target date (optional)": "Tanggal target (opsional)",
  "ready to start the diagnostic": "Siap memulai diagnostik",
  "the diagnostic is short and untimed. its answer key is never sent to your browser. you will see an evaluated starting point before the curriculum is generated.":
    "Diagnostiknya singkat dan tanpa batas waktu. Kunci jawabannya tidak pernah dikirim ke browser. Kamu akan melihat titik awal yang dievaluasi sebelum kurikulum dibuat.",
  "title": "Judul",
  "weekly time": "Waktu mingguan",
  "minutes": "menit",
  "goal": "Tujuan",
  "success": "Keberhasilan",
  "level": "Level",
  "experience": "Pengalaman",
  "known topics": "Topik yang dikuasai",
  "formats": "Format",
  "target date": "Tanggal target",
  "context": "Konteks",
  "could not create the learning goal": "Gagal membuat tujuan belajar",
  "back": "Kembali",
  "continue": "Lanjut",
  "create goal and start diagnostic": "Buat tujuan dan mulai diagnostik",
  "what happens next": "Apa yang terjadi selanjutnya",
  "a short diagnostic checks your starting point.":
    "Diagnostik singkat memeriksa titik awalmu.",
  "you see the evaluated gaps, not a hidden score.":
    "Kamu melihat celah yang dievaluasi, bukan skor tersembunyi.",
  "the architect drafts modules, classes and lessons.":
    "Arsitek menyusun modul, kelas, dan pelajaran.",
  "you review, edit, regenerate, and approve it.":
    "Kamu meninjau, mengedit, membuat ulang, dan menyetujuinya.",
  "nothing is enrolled until you approve the curriculum. regeneration keeps the previous approved version intact.":
    "Tidak ada yang diikuti sampai kamu menyetujui kurikulum. Pembuatan ulang menjaga versi yang sudah disetujui tetap utuh.",

  // App: diagnostic
  "could not load this learning goal": "Gagal memuat tujuan belajar ini",
  "could not load the diagnostic": "Gagal memuat diagnostik",
  "learning goal not found": "Tujuan belajar tidak ditemukan",
  "this goal does not exist or is not yours.":
    "Tujuan ini tidak ada atau bukan milikmu.",
  "starting point": "Titik awal",
  "a short diagnostic.": "Diagnostik singkat.",
  "generate the diagnostic": "Buat diagnostik",
  "designing questions": "Menyusun pertanyaan",
  "this page refreshes automatically.": "Halaman ini diperbarui otomatis.",
  "your answers are saved.": "Jawabanmu tersimpan.",
  "evaluating your answers...": "Mengevaluasi jawabanmu...",
  "this diagnostic is already evaluated.": "Diagnostik ini sudah dievaluasi.",
  "questions for this goal": "pertanyaan untuk tujuan ini",
  "the previous attempt failed": "Percobaan sebelumnya gagal",
  "could not generate the diagnostic": "Gagal membuat diagnostik",
  "your answer": "Jawabanmu",
  "explain your reasoning, or say what you would do.":
    "Jelaskan alasanmu, atau katakan apa yang akan kamu lakukan.",
  "could not submit the diagnostic": "Gagal mengirim diagnostik",
  "evaluation failed": "Evaluasi gagal",
  "the diagnostic could not be generated": "Diagnostik tidak bisa dibuat",
  "retry failed": "Percobaan ulang gagal",

  // App: diagnostic result
  "could not load the result": "Gagal memuat hasil",
  "diagnostic result": "Hasil diagnostik",
  "evaluated starting point": "Titik awal yang dievaluasi",
  "estimated level": "Perkiraan level",
  "strengths": "Kekuatan",
  "no strengths were identified yet. that is a starting point, not a judgment.":
    "Belum ada kekuatan yang teridentifikasi. Itu titik awal, bukan penilaian.",
  "knowledge gaps": "Celah pengetahuan",
  "no specific gaps were identified. the curriculum will still build from the goal.":
    "Tidak ada celah spesifik yang teridentifikasi. Kurikulum tetap akan dibangun dari tujuanmu.",
  "possible misconceptions": "Kemungkinan miskonsepsi",
  "next:": "Selanjutnya:",
  "why this evaluation": "Mengapa evaluasi ini",
  "question feedback": "Umpan balik pertanyaan",
  "this is an ai estimate, not a certification":
    "Ini perkiraan AI, bukan sertifikasi",
  "no diagnostic yet": "Belum ada diagnostik",
  "start with a short diagnostic before the curriculum is generated.":
    "Mulai dengan diagnostik singkat sebelum kurikulum dibuat.",
  "the evaluation is not ready": "Evaluasi belum siap",

  // App: generating
  "could not check the generation": "Gagal memeriksa proses pembuatan",
  "generating curriculum": "Membuat kurikulum",
  "generation stopped": "Pembuatan berhenti",
  "preparing generation": "Menyiapkan pembuatan",
  "you can leave this page and come back; the server keeps working and the draft will be waiting.":
    "Kamu bisa meninggalkan halaman ini dan kembali nanti; server tetap bekerja dan draf akan menunggu.",
  "review the error below and retry.": "Tinjau error di bawah lalu coba lagi.",
  "read the goal and diagnostic": "Membaca tujuan dan diagnostik",
  "design modules, classes and lessons": "Merancang modul, kelas, dan pelajaran",
  "validate structure and references": "Memvalidasi struktur dan referensi",
  "the curriculum could not be generated": "Kurikulum tidak bisa dibuat",
  "drafting your curriculum.": "Menyusun kurikulummu.",

  // App: course review
  "the title must be between 3 and 160 characters.":
    "Judul harus antara 3 dan 160 karakter.",
  "the short description must be between 10 and 400 characters.":
    "Deskripsi singkat harus antara 10 dan 400 karakter.",
  "the description must be between 3 and 4000 characters.":
    "Deskripsi harus antara 3 dan 4000 karakter.",
  "every module title must be between 2 and 200 characters.":
    "Setiap judul modul harus antara 2 dan 200 karakter.",
  "every class title must be between 2 and 200 characters.":
    "Setiap judul kelas harus antara 2 dan 200 karakter.",
  "could not load the draft": "Gagal memuat draf",
  "this course has no curriculum to review.": "Kursus ini tidak punya kurikulum untuk ditinjau.",
  "describe what should change in at least 10 characters.":
    "Jelaskan apa yang harus diubah minimal 10 karakter.",
  "a new draft was generated. your approved curriculum is still live.":
    "Draf baru telah dibuat. Kurikulum yang sudah disetujui tetap aktif.",
  "what should change?": "Apa yang harus diubah?",
  "e.g. make the second half more project-based and add a testing module.":
    "mis. Buat paruh kedua lebih berbasis proyek dan tambahkan modul pengujian.",
  "could not create a draft": "Gagal membuat draf",
  "draft saved.": "Draf tersimpan.",
  "a new draft was generated. the previous approved version is untouched.":
    "Draf baru telah dibuat. Versi yang disetujui sebelumnya tidak berubah.",
  "curriculum approved. you are enrolled.": "Kurikulum disetujui. Kamu sudah terdaftar.",
  "this draft changed. reload the page and review the latest version.":
    "Draf ini berubah. Muat ulang halaman dan tinjau versi terbaru.",
  "curriculum review": "Tinjauan kurikulum",
  "review before you enroll.": "Tinjau sebelum kamu mengikuti.",
  "unsaved changes": "Perubahan belum disimpan",
  "course at a glance": "Ringkasan kursus",
  "methodology": "Metodologi",
  "expected outcome": "Hasil yang diharapkan",
  "framing": "Kerangka",
  "short description": "Deskripsi singkat",
  "description": "Deskripsi",
  "modules and classes": "Modul dan kelas",
  "module title": "Judul modul",
  "module description": "Deskripsi modul",
  "not quite right? regenerate.": "Belum pas? Buat ulang.",
  "approve this curriculum": "Setujui kurikulum ini",
  "validation warnings": "Peringatan validasi",
  "could not save the draft": "Gagal menyimpan draf",
  "save your edits before approving.": "Simpan perubahan sebelum menyetujui.",
  "all edits are saved.": "Semua perubahan tersimpan.",
  "e.g. add more hands-on exercises and reduce the theory. keep the final project.":
    "mis. Tambahkan lebih banyak latihan praktik dan kurangi teori. Pertahankan proyek akhir.",
  "regenerate draft": "Buat ulang draf",
  "approve this curriculum?": "Setujui kurikulum ini?",
  "this becomes your enrolled curriculum. you can still create a newer draft later without losing this version.":
    "Kurikulum ini akan menjadi kurikulum yang kamu ikuti. Kamu tetap bisa membuat draf lebih baru nanti tanpa kehilangan versi ini.",
  "this curriculum is approved.": "Kurikulum ini sudah disetujui.",
  "create a new draft": "Buat draf baru",

  // App: course detail
  "summary:": "Ringkasan:",
  "deliverable:": "Hasil karya:",
  "knowledge check": "Cek pengetahuan",
  "concept explanation": "Penjelasan konsep",
  "introduction": "Pendahuluan",
  "summary": "Ringkasan",
  "what you will learn": "Apa yang akan kamu pelajari",
  "outcome:": "Hasil:",
  "method:": "Metode:",
  "competencies": "Kompetensi",
  "prerequisites": "Prasyarat",
  "final project": "Proyek akhir",
  "final assessment": "Asesmen akhir",
  "format:": "Format:",
  "prerequisite concepts": "Konsep prasyarat",
  "concept outline": "Kerangka konsep",
  "independent practice": "Latihan mandiri",
  "key concepts": "Konsep kunci",
  "evaluation criteria": "Kriteria evaluasi",
  "could not load the course": "Gagal memuat kursus",
  "this course does not exist or is not yours.":
    "Kursus ini tidak ada atau bukan milikmu.",
  "this course has no generated version.": "Kursus ini belum punya versi yang dihasilkan.",
  "a newer draft is under review": "Draf yang lebih baru sedang ditinjau",
  "current draft": "Draf saat ini",
  "draft preview": "Pratinjau draf",
  "passing criteria": "Kriteria kelulusan",
  "generation notes": "Catatan pembuatan",

  // Settings / profile
  "your profile, learning preferences and account. everything here is saved to supabase.":
    "Profil, preferensi belajar, dan akunmu. Semua di sini disimpan ke Supabase.",
  "could not load your profile": "Gagal memuat profilmu",
  "could not load your preferences": "Gagal memuat preferensimu",
  "signed in as": "Masuk sebagai",
  "reset email sent": "Email reset terkirim",
  "could not send reset email": "Gagal mengirim email reset",
  "send password reset email": "Kirim email reset kata sandi",
  "change password now": "Ubah kata sandi sekarang",
  "signing out removes this browser's access immediately. protected pages send you back to sign in.":
    "Keluar langsung menghapus akses browser ini. Halaman terlindungi akan mengarahkanmu kembali untuk masuk.",
  "profile": "Profil",
  "how you appear inside frikhii.": "Bagaimana kamu tampil di FRIKHII.",
  "avatar": "Avatar",
  "initials are used for now. uploads are planned.":
    "Untuk sementara memakai inisial. Unggah foto masih direncanakan.",
  "profile saved": "Profil tersimpan",
  "your name has been updated.": "Namamu telah diperbarui.",
  "could not save profile": "Gagal menyimpan profil",
  "email changes are not available yet. it stays private and is only visible to you.":
    "Perubahan email belum tersedia. Email tetap privat dan hanya terlihat olehmu.",
  "saving...": "Menyimpan...",
  "save changes": "Simpan perubahan",
  "learning preferences saved.": "Preferensi belajar tersimpan.",
  "used later to pick the language for generated lessons and the tutor.":
    "Digunakan nanti untuk memilih bahasa pelajaran dan tutor yang dihasilkan.",
  "preferences saved": "Preferensi tersimpan",
  "new lessons will use this language.": "Pelajaran baru akan memakai bahasa ini.",
  "could not save preferences": "Gagal menyimpan preferensi",
  "save preferences": "Simpan preferensi",
  "appearance preference saved.": "Preferensi tampilan tersimpan.",
  "appearance": "Tampilan",
  "a dark theme is not implemented yet, so every option currently renders the light theme. your choice is stored for when themes arrive.":
    "Tema gelap belum diimplementasikan, jadi semua opsi saat ini menampilkan tema terang. Pilihanmu disimpan untuk saat tema tersedia.",
  "appearance saved": "Tampilan tersimpan",
  "your theme preference has been stored.": "Preferensi temamu telah disimpan.",
  "could not save appearance": "Gagal menyimpan tampilan",
  "save appearance": "Simpan tampilan",
  "theme": "Tema",
  "system (light for now)": "Sistem (terang untuk saat ini)",
  "light": "Terang",

  // Additional app, auth and empty-state copy
  "check your email": "Cek emailmu",
  "check your email, a reset link is on its way. the link expires after a short time and works once.":
    "Cek emailmu, tautan reset sedang dikirim. Tautan ini kedaluwarsa setelah beberapa saat dan hanya bisa dipakai sekali.",
  "reset your password.": "Reset kata sandimu.",
  "if an account exists for": "Jika ada akun untuk",
  "open the link in this browser. if it does not arrive, check spam or request another link in a minute.":
    "Buka tautan itu di browser ini. Jika belum datang, cek folder spam atau minta tautan lain dalam satu menit.",
  "use a different email": "Gunakan email lain",
  "request a new link": "Minta tautan baru",
  "request a new reset link": "Minta tautan reset baru",
  "confirm new password": "Konfirmasi kata sandi baru",
  "password updated": "Kata sandi diperbarui",
  "continue to the app": "Lanjut ke aplikasi",
  "sign in with the new password": "Masuk dengan kata sandi baru",
  "use a password you have not used before.": "Gunakan kata sandi yang belum pernah dipakai.",
  "updating the password for": "Memperbarui kata sandi untuk",
  "verifying your reset link…": "Memverifikasi tautan resetmu…",
  "verifying your secure link…": "Memverifikasi tautan amanmu…",
  "link invalid or expired": "Tautan tidak valid atau kedaluwarsa",
  "verification failed": "Verifikasi gagal",
  "password recovery needs a configured supabase project.":
    "Pemulihan kata sandi memerlukan proyek Supabase yang sudah dikonfigurasi.",
  "this link needs a configured supabase project.":
    "Tautan ini memerlukan proyek Supabase yang sudah dikonfigurasi.",
  "connect supabase first.": "Hubungkan Supabase terlebih dahulu.",
  "supabase needs to be connected.": "Supabase perlu dihubungkan.",
  "could not continue": "Tidak bisa melanjutkan",
  "checking your session…": "Memeriksa sesimu…",
  "frikhii copilot is a personal ai learning companion. your learning data belongs to you.":
    "FRIKHII Copilot adalah pendamping belajar AI personal. Data belajarmu milikmu.",
  "turn ambition into capability.": "Ubah ambisi menjadi kemampuan.",
  "learn with intent": "Belajar dengan niat",
  "define your goal": "Tentukan tujuanmu",
  "build your roadmap": "Bangun peta jalanmu",
  "learn with ai": "Belajar dengan AI",
  "practice and prove it": "Berlatih dan buktikan",
  "honest answers, before you begin.": "Jawaban jujur, sebelum kamu mulai.",
  "what frikhii copilot does today, what is still being built, and where you should keep using your own judgment.":
    "Apa yang sudah dilakukan FRIKHII Copilot hari ini, apa yang masih dibangun, dan di mana kamu tetap perlu memakai penilaianmu sendiri.",
  "drafts to review": "Draf untuk ditinjau",
  "create a learning goal": "Buat tujuan belajar",
  "create your first course": "Buat kursus pertamamu",
  "new course": "Kursus baru",
  "no courses yet": "Belum ada kursus",
  "no curriculum yet": "Belum ada kurikulum",
  "view all": "Lihat semua",
  "see diagnostic result": "Lihat hasil diagnostik",
  "your goal pipeline": "Alur tujuanmu",
  "dashboard counts come from the core api. lesson completion and study-time progress are not tracked in phase 03, so no completion percentage is shown.":
    "Angka dasbor berasal dari Core API. Penyelesaian pelajaran dan progres waktu belajar belum dilacak di Fase 03, jadi tidak ada persentase penyelesaian.",
  "course content and versions are stored by the core api. lesson playback and progress tracking are outside phase 03.":
    "Konten dan versi kursus disimpan oleh Core API. Pemutaran pelajaran dan pelacakan progres berada di luar Fase 03.",
  "course not found": "Kursus tidak ditemukan",
  "draft not found": "Draf tidak ditemukan",
  "review and approve": "Tinjau dan setujui",
  "review the draft": "Tinjau draf",
  "suggested search topics": "Saran topik pencarian",
  "this curriculum is not approved yet. review the draft and approve it to enroll.":
    "Kurikulum ini belum disetujui. Tinjau draf dan setujui untuk mengikutinya.",
  "lesson playback and per-lesson progress are not part of phase 03. the curriculum, enrollment and version history are real and persisted.":
    "Pemutaran pelajaran dan progres per pelajaran bukan bagian dari Fase 03. Kurikulum, pendaftaran, dan riwayat versi sudah nyata dan tersimpan.",
  "approve and enroll": "Setujui dan ikuti",
  "could not approve": "Gagal menyetujui",
  "could not regenerate": "Gagal membuat ulang",
  "discard changes": "Buang perubahan",
  "generate a new draft": "Buat draf baru",
  "open the course": "Buka kursus",
  "there is no draft under review. you can read the enrolled curriculum, or ask the architect for a new draft. a new draft does not replace this version until you approve it.":
    "Tidak ada draf yang sedang ditinjau. Kamu bisa membaca kurikulum yang diikuti atau meminta arsitek membuat draf baru. Draf baru tidak menggantikan versi ini sampai kamu menyetujuinya.",
  "this can take up to a couple of minutes. you can leave this page; the server continues.":
    "Proses ini bisa memakan waktu beberapa menit. Kamu boleh meninggalkan halaman ini; server tetap bekerja.",
  "you are reviewing a newer draft. your enrolled curriculum does not change until you approve this draft.":
    "Kamu sedang meninjau draf yang lebih baru. Kurikulum yang kamu ikuti tidak berubah sampai kamu menyetujui draf ini.",
  "edit the framing, module names, or class descriptions. regenerate for a different approach. approve only when the plan is right for you.":
    "Edit kerangka, nama modul, atau deskripsi kelas. Buat ulang untuk pendekatan berbeda. Setujui hanya jika rencananya sudah tepat untukmu.",
  "describe what should change. the architect creates a new draft; the previous approved version stays live and untouched.":
    "Jelaskan apa yang harus diubah. Arsitek membuat draf baru; versi yang sudah disetujui tetap aktif dan tidak berubah.",
  "drafts are not enrolled until you approve them. an approved older version stays live while a newer draft is under review.":
    "Draf tidak diikuti sampai kamu menyetujuinya. Versi lama yang sudah disetujui tetap aktif selama draf baru ditinjau.",
  "answer in your own words. this is not a pass/fail test; it helps the architect avoid repeating what you already know and target the real gaps.":
    "Jawab dengan kata-katamu sendiri. Ini bukan tes lulus/gagal; jawabanmu membantu arsitek menghindari pengulangan dan menyasar celah yang sebenarnya.",
  "evaluating your answers…": "Mengevaluasi jawabanmu…",
  "generate diagnostic": "Buat diagnostik",
  "open the result": "Buka hasil",
  "retry evaluation": "Coba lagi evaluasi",
  "retry to create a fresh question set.": "Coba lagi untuk membuat set pertanyaan baru.",
  "submit for evaluation": "Kirim untuk evaluasi",
  "the evaluation did not complete. you can retry without retyping your answers.":
    "Evaluasi tidak selesai. Kamu bisa mencoba lagi tanpa mengetik ulang jawaban.",
  "generate my curriculum": "Buat kurikulum saya",
  "generation is in progress": "Pembuatan sedang berlangsung",
  "open the enrolled course": "Buka kursus yang diikuti",
  "return to the diagnostic": "Kembali ke diagnostik",
  "start diagnostic": "Mulai diagnostik",
  "the diagnostic is currently": "Diagnostik saat ini",
  "the evaluation is generated from your written answers. it can be wrong, and it is not a formal assessment. you can still review and revise the curriculum.":
    "Evaluasi dihasilkan dari jawaban tertulismu. Hasilnya bisa salah dan bukan asesmen formal. Kamu tetap bisa meninjau dan merevisi kurikulum.",
  "back to the result": "Kembali ke hasil",
  "the architect is turning your goal and diagnostic into modules, classes and lessons. nothing is enrolled yet; you will review the draft first.":
    "Arsitek sedang mengubah tujuan dan diagnostikmu menjadi modul, kelas, dan pelajaran. Belum ada yang diikuti; kamu akan meninjau drafnya terlebih dahulu.",
  "could not load": "Gagal memuat",
  "why now": "Mengapa sekarang",
  "your password has been changed. you can keep using this session or sign in again on your other devices.":
    "Kata sandimu telah diubah. Kamu bisa tetap memakai sesi ini atau masuk lagi di perangkat lain.",

  // API / query errors
  "something went wrong. please try again.": "Terjadi kesalahan. Silakan coba lagi.",
  "your session could not be read. sign in again.":
    "Sesi kamu tidak bisa dibaca. Masuk lagi.",
  "sign in again to continue.": "Masuk lagi untuk melanjutkan.",
  "the request failed.": "Permintaan gagal.",
  "the request took too long. you can retry.":
    "Permintaan terlalu lama. Kamu bisa mencoba lagi.",
  "could not reach the core api. check that it is running.":
    "Tidak bisa menghubungi Core API. Pastikan layanannya berjalan.",
  "the core api url is not configured. set vite_core_api_url before building the app.":
    "URL Core API belum dikonfigurasi. Set VITE_CORE_API_URL sebelum membangun aplikasi.",
  "the server returned a response the app could not read.":
    "Server mengembalikan respons yang tidak bisa dibaca aplikasi.",
  "the server returned an unexpected response shape.":
    "Server mengembalikan bentuk respons yang tidak terduga.",
  "could not sign out.": "Gagal keluar.",
  "profile updated.": "Profil diperbarui.",
};

const patterns: Array<[RegExp, string]> = [
  [/^step (\d+)$/i, "Langkah $1"],
  [/^(\d+) minutes$/i, "$1 menit"],
  [/^(\d+) questions? for this goal$/i, "$1 pertanyaan untuk tujuan ini"],
  [/^v(\d+) approved$/i, "v$1 disetujui"],
  [/^v(\d+) draft$/i, "v$1 draf"],
  [/^v(\d+) superseded$/i, "v$1 digantikan"],
  [/^(\d+)h total - (.+)$/i, "$1 jam total - $2"],
  [/^mode - (.+)$/i, "Mode - $1"],
];

const dictionary = Object.fromEntries(
  Object.entries(indonesian).map(([key, value]) => [normalize(key), value]),
);

function translateCore(core: string): string | null {
  const normalized = normalize(core);
  const direct = dictionary[normalized];
  if (direct) return direct;
  const withoutPunctuation = normalized.replace(/[.!?]+$/, "");
  const punctuationless = dictionary[withoutPunctuation];
  if (punctuationless) return punctuationless;
  const withoutLeading = normalized.replace(/^[.,;:!?]+\s*/, "");
  const leadingless = dictionary[withoutLeading];
  if (leadingless) return leadingless;
  for (const [pattern, replacement] of patterns) {
    if (pattern.test(core)) return core.replace(pattern, replacement);
  }
  return null;
}

function translateText(value: string): string {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const start = leading.length;
  const end = value.length - trailing.length;
  const core = value.slice(start, end);
  if (!core) return value;
  const translated = translateCore(core);
  return translated ? `${leading}${translated}${trailing}` : value;
}

const textOriginals = new WeakMap<Text, string>();
const attributeOriginals = new WeakMap<Element, Map<string, string>>();

const TRANSLATED_ATTRIBUTES = ["placeholder", "aria-label", "title", "alt"] as const;
const SKIPPED_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"]);

function shouldSkip(node: Node): boolean {
  let element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  while (element) {
    if (SKIPPED_TAGS.has(element.tagName)) return true;
    element = element.parentElement;
  }
  return false;
}

function translateTextNode(node: Text) {
  if (shouldSkip(node)) return;
  const current = node.data;
  const original = textOriginals.get(node);
  const translatedOriginal = original ? translateText(original) : null;
  // React may have written fresh English while Indonesian was active.
  if (!original || (translatedOriginal !== current && original !== current)) {
    textOriginals.set(node, current);
  }
  const source = textOriginals.get(node) ?? current;
  const next = translateText(source);
  if (next !== current) node.data = next;
}

function translateElement(element: Element) {
  if (shouldSkip(element)) return;
  for (const name of TRANSLATED_ATTRIBUTES) {
    const value = element.getAttribute(name);
    if (!value) continue;
    let originals = attributeOriginals.get(element);
    if (!originals) {
      originals = new Map();
      attributeOriginals.set(element, originals);
    }
    const original = originals.get(name);
    if (!original || (translateText(original) !== value && original !== value)) {
      originals.set(name, value);
    }
    const source = originals.get(name) ?? value;
    const next = translateText(source);
    if (next !== value) element.setAttribute(name, next);
  }
}

function walk(root: Node, apply: (node: Text) => void) {
  if (root.nodeType === Node.TEXT_NODE) {
    apply(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  const element = root as Element;
  if (element.nodeType === Node.ELEMENT_NODE) translateElement(element);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    apply(node as Text);
    node = walker.nextNode();
  }
  if (element.nodeType === Node.ELEMENT_NODE) {
    for (const child of Array.from(element.querySelectorAll("*"))) {
      translateElement(child);
    }
  }
}

function restore(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    const text = root as Text;
    const original = textOriginals.get(text);
    if (original !== undefined && text.data !== original) text.data = original;
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  const element = root as Element;
  if (element.nodeType === Node.ELEMENT_NODE) {
    const originals = attributeOriginals.get(element);
    if (originals) {
      for (const [name, value] of originals) {
        if (element.getAttribute(name) !== value) element.setAttribute(name, value);
      }
    }
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node as Text;
    const original = textOriginals.get(text);
    if (original !== undefined && text.data !== original) text.data = original;
    node = walker.nextNode();
  }
  if (element.nodeType === Node.ELEMENT_NODE) {
    for (const child of Array.from(element.querySelectorAll("*"))) {
      const originals = attributeOriginals.get(child);
      if (!originals) continue;
      for (const [name, value] of originals) {
        if (child.getAttribute(name) !== value) child.setAttribute(name, value);
      }
    }
  }
}

function initialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "id") return stored;
  return window.navigator.language.toLowerCase().startsWith("id") ? "id" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage can be unavailable in private windows.
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? "id" : "en");
  }, [language, setLanguage]);

  const t = useCallback(
    (text: string) => (language === "id" ? translateText(text) : text),
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, toggleLanguage, t }),
    [language, setLanguage, toggleLanguage, t],
  );

  useEffect(() => {
    document.documentElement.lang = language === "id" ? "id" : "en";
    const body = document.body;
    if (!body) return;

    if (language === "en") {
      restore(body);
    } else {
      walk(body, translateTextNode);
    }

    let applying = false;
    const observer = new MutationObserver((mutations) => {
      if (applying) return;
      applying = true;
      try {
        for (const mutation of mutations) {
          if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
            if (language === "id") translateTextNode(mutation.target as Text);
          } else if (mutation.type === "attributes" && mutation.target.nodeType === Node.ELEMENT_NODE) {
            if (language === "id") translateElement(mutation.target as Element);
          } else {
            for (const node of Array.from(mutation.addedNodes)) {
              if (language === "id") walk(node, translateTextNode);
            }
          }
        }
      } finally {
        queueMicrotask(() => {
          applying = false;
        });
      }
    });

    observer.observe(body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATED_ATTRIBUTES],
    });

    return () => observer.disconnect();
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext) ?? fallback;
}
