# FRIKHII COPILOT
## Product Requirements Document (PRD) — Version 1.1

**Product:** FRIKHII Copilot  
**Brand:** FRIKHII  
**Category:** Personal AI Learning Companion  
**Tagline:** Learn with intent. Become capable.  
**Platform:** Web Application  
**Initial Audience:** Personal User  
**Deployment:** Vercel + Backend Hosting + Supabase

---

## 1. PRODUCT VISION

FRIKHII Copilot adalah Personal AI Learning Companion yang membantu pengguna mengubah tujuan belajar menjadi perjalanan pembelajaran terstruktur dan terukur.

FRIKHII membantu pengguna:
- Menentukan arah belajar.
- Menghasilkan personalized learning roadmap.
- Mempelajari materi dengan AI Tutor.
- Memahami konsep melalui praktik.
- Mengikuti assessment.
- Mengukur perkembangan kompetensi.

Filosofi produk:

**UNDERSTAND → EXPLAIN → PRACTICE → EVALUATE → MASTER**

## 2. TARGET USER

Pengguna awal adalah satu pengguna personal sebagai pilot tester.

Platform dikembangkan dengan arsitektur yang dapat diperluas menjadi produk untuk mahasiswa dan pengguna umum.

## 3. PRODUCT MODULES

### P0 — AI Course Architect
Mengubah learning goal menjadi kurikulum terstruktur melalui analisis tujuan, diagnostic assessment, prerequisite, modules, classes, lessons, exercises, dan evaluasi.

### P0 — Learning Roadmap
Menampilkan kurikulum dengan status Locked, Available, In Progress, Completed, dan Needs Review.

Class berikutnya hanya dapat dibuka setelah persyaratan class sebelumnya dipenuhi dan divalidasi backend.

### P0 — AI Personal Tutor
Mode Explain, Deep Dive, Socratic, Practice, Review, dan Project.

### P0 — Lesson Engine
Menyediakan introduction, learning objectives, explanation, examples, demonstration, exercise, knowledge check, dan summary.

### P0 — Assessment Engine
Mendukung multiple choice, true/false, short answer, explanation-based questions, dan coding exercises.

Passing score awal: 80%, dapat dikonfigurasi.

### P0 — Learning Intelligence
Mencatat lesson completion, assessment results, knowledge gaps, competencies, dan learning progress.

### P1/P2 — Multimodal Learning
Dikembangkan untuk mendukung PDF, DOCX, PPTX, XLSX, foto, screenshot, audio, dan video.

Output mencakup penjelasan, rangkuman, flashcard, quiz, infografis, diagram, kode, dan dokumen.

---

## 4. PUBLIC LANDING PAGE

**Priority: P0**

Landing page merupakan halaman publik utama untuk memperkenalkan FRIKHII Copilot.

Landing page harus memiliki identitas visual premium, editorial, modern, dan konsisten dengan brand system FRIKHII.

### 4.1 Hero Section

Konten:
- FRIKHII wordmark.
- Tagline.
- Product positioning.
- Headline yang menjelaskan manfaat utama.
- Primary CTA: Start Learning.
- Secondary CTA: Discover FRIKHII.

Headline direction:

"Your ambition deserves a better way to learn."

Subheadline:

"Turn your curiosity into structured learning, guided by personal AI."

### 4.2 Product Trailer Section

**Priority: P0**

Menyiapkan placeholder video trailer produk.

Persyaratan:
- Video container dengan rasio 16:9.
- Custom poster/thumbnail.
- Play button.
- Judul dan deskripsi video.
- Placeholder video URL yang dapat diganti.
- Responsive video player.
- Tidak autoplay dengan suara.
- Mendukung YouTube/Vimeo embed atau self-hosted video.
- Lazy loading untuk mengoptimalkan performa.
- Fallback poster ketika video belum tersedia.

Judul section:

"Meet your new learning companion."

Tujuan trailer adalah memperkenalkan:
1. Masalah pembelajaran tanpa arah.
2. Perkenalan FRIKHII Copilot.
3. AI Course Architect.
4. Personalized Learning Roadmap.
5. AI Personal Tutor.
6. Learning assessment dan progression.
7. Brand manifesto.

Untuk MVP, media trailer belum wajib tersedia. Placeholder harus dapat ditampilkan tanpa merusak layout.

### 4.3 Visual & Photography Showcase

**Priority: P0**

Landing page memiliki beberapa image placeholder untuk menampilkan identitas visual FRIKHII.

Kategori visual yang disiapkan:

- Product interface showcase.
- AI learning experience.
- Student learning environment.
- Course roadmap preview.
- AI Tutor interaction preview.
- Editorial brand photography.
- Campaign imagery.

Persyaratan:
- Image slots dapat diperbarui melalui konfigurasi asset.
- Konsistensi aspect ratio.
- Responsive image rendering.
- Lazy loading.
- Alt text.
- Fallback image.
- Tidak mengharuskan seluruh foto sudah tersedia ketika aplikasi pertama kali dirilis.

Foto harus mendukung storytelling produk, bukan sekadar dekorasi.

### 4.4 The Problem Section

Menggambarkan permasalahan pembelajaran:
- Tidak memiliki roadmap.
- Materi tersebar.
- Sulit memahami konsep.
- Tidak ada evaluasi.
- Tidak mengetahui kemampuan yang perlu ditingkatkan.

### 4.5 The Solution Section

Memperkenalkan cara kerja FRIKHII:
- Define your goal.
- Generate your roadmap.
- Learn with AI.
- Practice and evaluate.
- Become capable.

### 4.6 AI Course Architect Showcase

Menampilkan simulasi pembuatan roadmap dari sebuah learning goal.

### 4.7 AI Tutor Showcase

Menampilkan contoh interaksi tutor dan pengalaman pembelajaran personal.

### 4.8 Product Interface Showcase

Menampilkan screenshot atau mockup:
- Dashboard.
- Course roadmap.
- Lesson workspace.
- Assessment interface.
- Learning analytics.

Placeholder screenshot harus bisa diganti dengan screenshot aplikasi sesungguhnya setelah MVP tersedia.

### 4.9 Final CTA

Headline:

"Your next chapter starts with learning."

CTA:

"Start your journey."

### 4.10 Footer

Menampilkan:
- FRIKHII brand.
- Product description.
- Navigation.
- Privacy.
- Terms.
- Contact.

---

## 5. DESIGN SYSTEM

### Brand Colors

- Midnight Ink: #111318
- Warm Paper: #F5F3ED
- Signal Lime: #D5F26A
- Electric Blue: #5268F5

### Typography

- Geist Sans.
- Geist Mono.

### Design Principles

- Premium editorial layout.
- Strong visual hierarchy.
- Generous whitespace.
- Custom wordmark.
- Restrained animation.
- Consistent component library.
- High-quality responsive layouts.
- Accessible contrast and keyboard interaction.

Landing page harus memiliki visual identity yang sama dengan authenticated application.

---

## 6. APPLICATION STRUCTURE

### Public
- Landing Page.
- Product Overview.
- Login.
- Register.

### Authenticated
- Dashboard.
- My Courses.
- Course Architect.
- Course Workspace.
- AI Tutor.
- Assessment.
- Learning Analytics.
- Settings.

---

## 7. TECHNICAL STACK

### Frontend
- React.
- Vite 8.
- TypeScript.
- Tailwind CSS 4.
- Radix UI.
- Motion.
- React Router.
- TanStack Query.
- Zustand.
- React Hook Form.
- Zod.
- Lucide.

Deployment: Vercel.

### Backend Core
- Go.
- Chi HTTP Router.

Responsibilities: users, courses, lessons, assessment, progress, unlock validation, analytics, and API authorization.

### Backend AI
- Python.
- FastAPI.

Responsibilities: LLM orchestration, AI Tutor, course generation, lesson generation, evaluation, RAG, document processing, and multimodal processing.

### Database
- Supabase PostgreSQL.
- Supabase Auth.
- Supabase Storage.
- pgvector.
- Row Level Security.

### LLM
- Free-tier API providers initially.
- Provider abstraction.
- Model fallback.
- Rate limiting.
- Usage monitoring.
- Prompt versioning.

---

## 8. DATABASE ENTITIES

Initial tables:

1. profiles
2. learning_goals
3. courses
4. course_versions
5. course_modules
6. classes
7. lessons
8. lesson_contents
9. learning_objectives
10. exercises
11. assessments
12. questions
13. assessment_attempts
14. assessment_answers
15. course_enrollments
16. lesson_progress
17. conversations
18. messages
19. uploaded_documents
20. document_chunks
21. learning_analytics
22. user_preferences

Course structure, learning progress, and media assets must be stored independently to support future revisions and product expansion.

---

## 9. MEDIA ASSET MANAGEMENT

Initial landing page media may use static placeholders.

Recommended asset configuration:

- trailer_video_url
- trailer_poster_url
- hero_visual_url
- showcase_image_01
- showcase_image_02
- showcase_image_03
- course_preview_image
- tutor_preview_image
- dashboard_preview_image

Final media URLs should be replaceable without changing application components.

The application must not break when a media file is missing.

---

## 10. SECURITY

- Keep backend secrets outside frontend.
- Enforce Supabase RLS.
- Verify JWTs on protected requests.
- Restrict file access.
- Validate AI-generated structured content.
- Validate course unlock conditions server-side.
- Secure uploaded user documents.
- Apply API rate limiting.

---

## 11. MVP SCOPE

### P0
- Premium landing page.
- Video trailer placeholder.
- Photo and image placeholders.
- Authentication.
- Dashboard.
- Course Architect.
- Learning roadmap.
- AI Tutor.
- Lesson Engine.
- Assessment.
- Remedial.
- Sequential unlock.
- Progress tracking.

### P1
- Document upload.
- RAG.
- Image understanding.
- Flashcard.
- Code generation.
- Flowchart generation.

### P2
- Audio and video understanding.
- Advanced multimodal generation.
- Infographic and presentation generation.
- Authorized university system integrations.

---

## 12. INTEGRATION STRATEGY

Gunadarma integrations are deliberately excluded from the first MVP.

Future integrations may include RPS, VClass, iLab, iFLab, Studentsite, Kemahasiswaan, HPC, and other authorized university platforms.

Integration will only be implemented after identifying supported APIs, permitted access methods, and data governance requirements.

---

## 13. ACCEPTANCE CRITERIA

The MVP must support:

1. A working public landing page.
2. Responsive trailer placeholder.
3. Replaceable image placeholders.
4. Authentication.
5. Course generation.
6. Roadmap approval.
7. Sequential class access.
8. AI Tutor interactions.
9. Practice and assessment.
10. Remedial workflow.
11. Persistent progress.
12. Secure user data isolation.
13. Successful deployment.

---

## 14. PRODUCT MANIFESTO

FRIKHII believes learning should have direction.

Answers alone are not enough. Information alone is not enough.

Real learning happens when people understand concepts, practice what they learn, evaluate their abilities, and build the confidence to solve problems independently.

FRIKHII exists to help turn ambition into capability.

**FRIKHII.**

**Learn with intent. Become capable.**