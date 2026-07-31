import { useState, useMemo, useRef } from 'react';
import { useLanguage } from '@/i18n';
import { PageLayout } from '@/components/layout/PageLayout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, BookOpen, LayoutDashboard, Inbox, Plus, Users, Timer, BarChart3,
  ShieldCheck, Building2, Zap, Globe, Webhook, Settings, Star,
  FileSearch, Mail, MessageSquare, Plug, Activity,
  Download, CheckCircle2, Lightbulb, HelpCircle,
  BookMarked, Monitor, Lock, Bell, Layers, FileText, PlayCircle,
  ArrowUpRight, ChevronRight, Sparkles, Eye, Clock, Target,
  AlertTriangle, Workflow, Shield, Database, Key, UserCheck,
  FolderOpen, MessageCircle, Headphones, Palette, Send, Filter,
  PieChart, TrendingUp, FileBarChart, CalendarDays, Loader2,
  ExternalLink, Video, GraduationCap, Award, Hash
} from 'lucide-react';

// ===================== TYPES =====================
interface GuideStep {
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  noteAr?: string;
  noteEn?: string;
}

interface GuideSection {
  id: string;
  titleAr: string;
  titleEn: string;
  icon: any;
  category: Category;
  descAr?: string;
  descEn?: string;
  videoUrl?: string;
  steps: GuideStep[];
  tipsAr?: string[];
  tipsEn?: string[];
  warningsAr?: string[];
  warningsEn?: string[];
  faqAr?: { q: string; a: string }[];
  faqEn?: { q: string; a: string }[];
}

type Category = 'basics' | 'tickets' | 'admin' | 'reports' | 'integrations' | 'security';

// ===================== DATA =====================
const guideSections: GuideSection[] = [
  // ======= BASICS =======
  {
    id: 'dashboard',
    titleAr: 'لوحة التحكم الرئيسية',
    titleEn: 'Main Dashboard',
    icon: LayoutDashboard,
    category: 'basics',
    descAr: 'مركز القيادة الرئيسي الذي يمنحك نظرة شاملة وفورية على أداء نظام الدعم الفني بالكامل.',
    descEn: 'The main command center that gives you a comprehensive, real-time overview of your entire support system performance.',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    steps: [
      { titleAr: 'بطاقات مؤشرات الأداء (KPIs)', titleEn: 'KPI Cards', descAr: 'تعرض 6 بطاقات رئيسية: التذاكر الجديدة، المفتوحة، قيد التنفيذ، المحلولة، المتأخرة عن SLA، ونسبة الامتثال. كل بطاقة قابلة للنقر للتنقل المباشر.', descEn: 'Displays 6 main cards: new, open, in-progress, resolved, SLA overdue, and compliance rate. Each card is clickable for direct navigation.', noteAr: 'البطاقات تتحدث تلقائياً في الوقت الفعلي عبر تقنية Realtime.', noteEn: 'Cards update automatically in real-time via Realtime technology.' },
      { titleAr: 'الفلاتر الزمنية المتقدمة', titleEn: 'Advanced Time Filters', descAr: 'اختر من بين فلاتر مسبقة (اليوم، الأسبوع، الشهر، ربع سنوي، سنوي) أو حدد نطاقاً زمنياً مخصصاً باستخدام التقويم المزدوج.', descEn: 'Choose from preset filters (today, week, month, quarter, year) or specify a custom date range using the dual calendar.' },
      { titleAr: 'الرسوم البيانية التفاعلية', titleEn: 'Interactive Charts', descAr: 'تتضمن: رسم بياني خطي لاتجاهات التذاكر عبر الزمن، رسم دائري لتوزيع الحالات، رسم شريطي لتحليل الأولويات، ورسم بياني لأداء الأقسام.', descEn: 'Includes: line chart for ticket trends over time, pie chart for status distribution, bar chart for priority analysis, and department performance chart.' },
      { titleAr: 'الإجراءات السريعة', titleEn: 'Quick Actions', descAr: 'أزرار وصول سريع لأكثر الإجراءات استخداماً: إنشاء تذكرة جديدة، عرض التذاكر المعلقة، فتح التقارير.', descEn: 'Quick access buttons for most-used actions: create new ticket, view pending tickets, open reports.' },
      { titleAr: 'آخر النشاطات', titleEn: 'Recent Activity', descAr: 'خلاصة حية تعرض آخر التحديثات على التذاكر: تعيين، تغيير حالة، تعليقات جديدة، موافقات.', descEn: 'Live feed showing latest ticket updates: assignments, status changes, new comments, approvals.' },
      { titleAr: 'تصدير البيانات', titleEn: 'Data Export', descAr: 'صدّر بيانات لوحة التحكم بصيغة CSV مع ترميز UTF-8 BOM لدعم اللغة العربية، أو بصيغة PDF جاهزة للطباعة مع الرسوم البيانية.', descEn: 'Export dashboard data in CSV format with UTF-8 BOM encoding for Arabic support, or in print-ready PDF format with charts.' },
    ],
    tipsAr: [
      'اضغط على أي بطاقة KPI للتنقل مباشرة إلى التذاكر ذات الصلة',
      'يمكنك تغيير نوع الرسم البياني بالنقر على الأيقونات في شريط أدوات الرسم',
      'لوحة التحكم تتحدث في الوقت الحقيقي - لا حاجة لتحديث الصفحة',
    ],
    tipsEn: [
      'Click any KPI card to navigate directly to related tickets',
      'You can change chart type by clicking icons in the chart toolbar',
      'Dashboard updates in real-time - no need to refresh the page',
    ],
    faqAr: [
      { q: 'لماذا لا تتطابق الأرقام مع صندوق الوارد؟', a: 'تأكد من أن الفلتر الزمني المحدد في لوحة التحكم يتوافق مع الفلاتر في صندوق الوارد.' },
    ],
    faqEn: [
      { q: 'Why do numbers not match the inbox?', a: 'Make sure the time filter selected in the dashboard matches the filters in the inbox.' },
    ],
  },
  {
    id: 'profile',
    titleAr: 'الملف الشخصي والإعدادات',
    titleEn: 'Profile & Settings',
    icon: UserCheck,
    category: 'basics',
    descAr: 'إدارة بياناتك الشخصية وتفضيلات الإشعارات واللغة.',
    descEn: 'Manage your personal information, notification preferences, and language settings.',
    steps: [
      { titleAr: 'تعديل البيانات الشخصية', titleEn: 'Edit Personal Info', descAr: 'عدّل الاسم الكامل، المسمى الوظيفي، رقم الجوال، المدينة، الدولة، والصورة الشخصية. التغييرات تنعكس فوراً على ملفك في النظام.', descEn: 'Edit full name, job title, phone number, city, country, and profile photo. Changes reflect immediately on your system profile.' },
      { titleAr: 'تفضيلات الإشعارات', titleEn: 'Notification Preferences', descAr: 'تحكم دقيق في 7 أنواع من الإشعارات: إنشاء تذكرة، تعيين تذكرة، تغيير حالة، إضافة تعليق، خرق SLA، موافقات، والتقرير الأسبوعي.', descEn: 'Fine-grained control over 7 notification types: ticket creation, assignment, status change, comment added, SLA breach, approvals, and weekly report.' },
      { titleAr: 'تغيير اللغة', titleEn: 'Change Language', descAr: 'اختر العربية أو الإنجليزية. يتم حفظ التفضيل تلقائياً وتتغير واجهة النظام بالكامل فوراً بما في ذلك اتجاه النصوص (RTL/LTR).', descEn: 'Choose Arabic or English. The preference is saved automatically and the entire system interface changes instantly including text direction (RTL/LTR).' },
      { titleAr: 'تغيير كلمة المرور', titleEn: 'Change Password', descAr: 'يمكنك تغيير كلمة المرور من صفحة الملف الشخصي أو من خلال رابط "إعادة تعيين كلمة المرور" في صفحة تسجيل الدخول.', descEn: 'You can change your password from the profile page or through the "Reset Password" link on the login page.' },
    ],
    tipsAr: ['يُفضّل تفعيل جميع الإشعارات المتعلقة بتخصصك لضمان عدم تفويت أي تحديث مهم'],
    tipsEn: ['It is recommended to enable all notifications related to your specialization to ensure no important updates are missed'],
  },
  {
    id: 'notifications',
    titleAr: 'نظام الإشعارات الذكي',
    titleEn: 'Smart Notification System',
    icon: Bell,
    category: 'basics',
    descAr: 'نظام إشعارات فوري متعدد القنوات يضمن عدم تفويت أي تحديث مهم.',
    descEn: 'Multi-channel real-time notification system ensuring no important update is missed.',
    steps: [
      { titleAr: 'إشعارات داخل التطبيق', titleEn: 'In-App Notifications', descAr: 'تنبيهات فورية تظهر في جرس الإشعارات مع صوت تنبيه قابل للتخصيص. تظهر عدد الإشعارات غير المقروءة.', descEn: 'Instant alerts appear in the notification bell with customizable alert sound. Shows unread notification count.' },
      { titleAr: 'البريد الإلكتروني', titleEn: 'Email Notifications', descAr: 'رسائل بريد إلكتروني مصممة باحترافية لكل حدث مع رابط مباشر للتذكرة. يمكن تعطيل أنواع محددة من الملف الشخصي.', descEn: 'Professionally designed emails for each event with direct ticket link. Specific types can be disabled from profile.' },
      { titleAr: 'صندوق الإشعارات', titleEn: 'Notification Inbox', descAr: 'صفحة مخصصة لعرض جميع الإشعارات مع فلاتر (مقروء/غير مقروء) وإمكانية وضع علامة كمقروء فردياً أو جماعياً.', descEn: 'Dedicated page to view all notifications with filters (read/unread) and the ability to mark as read individually or in bulk.' },
    ],
    tipsAr: ['اضغط على أي إشعار للانتقال مباشرة إلى التذكرة المعنية'],
    tipsEn: ['Click any notification to navigate directly to the related ticket'],
  },
  {
    id: 'knowledge-base',
    titleAr: 'قاعدة المعرفة',
    titleEn: 'Knowledge Base',
    icon: BookMarked,
    category: 'basics',
    descAr: 'مستودع مقالات معرفية ووثائق تقنية لمساعدة الفريق والعملاء.',
    descEn: 'A repository of knowledge articles and technical docs to help the team and customers.',
    steps: [
      { titleAr: 'المقالات العامة', titleEn: 'Public Articles', descAr: 'مقالات تظهر للعملاء في بوابتهم. تدعم تنسيق Markdown الكامل مع تصنيفات ووسوم وربط بالخدمات. يمكن للعملاء تقييمها.', descEn: 'Articles visible to customers in their portal. Supports full Markdown with categories, tags, and service linking. Customers can rate them.' },
      { titleAr: 'المقالات الداخلية', titleEn: 'Internal Articles', descAr: 'وثائق تقنية متخصصة لفريق الدعم فقط. تتضمن حلولاً معتمدة، إجراءات تشغيلية، وأدلة استكشاف الأخطاء لكل موديول.', descEn: 'Specialized technical docs for support team only. Include approved solutions, operational procedures, and troubleshooting guides per module.' },
      { titleAr: 'البحث المتقدم', titleEn: 'Advanced Search', descAr: 'بحث ذكي بالكلمات المفتاحية مع فلترة حسب التصنيف والنظام المرتبط والوسوم.', descEn: 'Smart keyword search with filtering by category, linked system, and tags.' },
      { titleAr: 'التقييم والمشاهدات', titleEn: 'Ratings & Views', descAr: 'نظام تقييم (مفيد/غير مفيد) مع عداد مشاهدات لقياس فائدة كل مقال وتحسين المحتوى.', descEn: 'Rating system (helpful/not helpful) with views counter to measure article usefulness and improve content.' },
    ],
    tipsAr: ['استخدم الوسوم (Tags) لتسهيل اكتشاف المقالات ذات الصلة بسرعة'],
    tipsEn: ['Use tags to quickly discover related articles'],
  },
  {
    id: 'customer-portal',
    titleAr: 'بوابة العملاء',
    titleEn: 'Customer Portal',
    icon: Monitor,
    category: 'basics',
    descAr: 'واجهة مخصصة لمقدمي الطلبات لإنشاء التذاكر ومتابعتها والتفاعل مع فريق الدعم.',
    descEn: 'A dedicated interface for requesters to create, track tickets, and interact with the support team.',
    steps: [
      { titleAr: 'لوحة تحكم العميل', titleEn: 'Customer Dashboard', descAr: 'إحصائيات مصغرة لتذاكر العميل: إجمالي التذاكر، المفتوحة، المحلولة، مع رسم بياني للاتجاهات.', descEn: 'Mini stats for customer tickets: total, open, resolved, with a trends chart.' },
      { titleAr: 'إنشاء التذاكر', titleEn: 'Create Tickets', descAr: 'نموذج إنشاء تذكرة مبسط مع معالج خطوة بخطوة يرشد العميل لتقديم المعلومات المطلوبة.', descEn: 'Simplified ticket creation form with a step-by-step wizard guiding the customer to provide required information.' },
      { titleAr: 'المحادثة الفورية مع AI', titleEn: 'AI Live Chat', descAr: 'تشات بوت ذكي يعمل بالذكاء الاصطناعي يقترح حلولاً من قاعدة المعرفة قبل إنشاء تذكرة. يدعم المرفقات.', descEn: 'Smart AI chatbot that suggests solutions from the knowledge base before creating a ticket. Supports attachments.' },
      { titleAr: 'تتبع التذاكر', titleEn: 'Track Tickets', descAr: 'متابعة حالة التذاكر الحالية مع شريط تقدم مرئي وإمكانية التعليق والتفاعل مع فريق الدعم.', descEn: 'Track current ticket status with a visual progress bar and ability to comment and interact with the support team.' },
      { titleAr: 'تقييم الخدمة (CSAT)', titleEn: 'Service Rating (CSAT)', descAr: 'بعد حل التذكرة، يظهر ويدجت لتقييم التجربة (1-5 نجوم) مع تعليق اختياري.', descEn: 'After ticket resolution, a widget appears to rate the experience (1-5 stars) with an optional comment.' },
    ],
  },
  {
    id: 'smart-search',
    titleAr: 'البحث الذكي',
    titleEn: 'Smart Search',
    icon: Search,
    category: 'basics',
    descAr: 'محرك بحث شامل يتيح البحث في التذاكر والمستخدمين والأقسام من مكان واحد.',
    descEn: 'A comprehensive search engine for searching tickets, users, and departments from one place.',
    steps: [
      { titleAr: 'اختصار لوحة المفاتيح', titleEn: 'Keyboard Shortcut', descAr: 'اضغط Ctrl+K (أو Cmd+K على Mac) لفتح صندوق البحث الذكي من أي مكان في النظام.', descEn: 'Press Ctrl+K (or Cmd+K on Mac) to open the smart search box from anywhere in the system.' },
      { titleAr: 'البحث الشامل', titleEn: 'Universal Search', descAr: 'يبحث في التذاكر (بالعنوان والرقم والوصف)، المستخدمين (بالاسم والبريد)، والأقسام.', descEn: 'Searches tickets (by title, number, description), users (by name and email), and departments.' },
      { titleAr: 'النتائج الفورية', titleEn: 'Instant Results', descAr: 'نتائج تظهر أثناء الكتابة مع تصنيف حسب النوع وإمكانية التنقل المباشر بالنقر.', descEn: 'Results appear as you type with categorization by type and direct navigation on click.' },
    ],
  },

  // ======= TICKETS =======
  {
    id: 'create-ticket',
    titleAr: 'إنشاء تذكرة جديدة',
    titleEn: 'Create New Ticket',
    icon: Plus,
    category: 'tickets',
    descAr: 'عملية إنشاء تذكرة دعم فني شاملة مع معالج ذكي متعدد الخطوات.',
    descEn: 'A comprehensive support ticket creation process with a smart multi-step wizard.',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    steps: [
      { titleAr: 'الخطوة 1: اختيار النظام المصدر', titleEn: 'Step 1: Select Source System', descAr: 'اختر النظام الذي تواجه فيه المشكلة: ERP (نظام إدارة الموارد)، LMS (نظام إدارة التعلم)، CPAY (الدفع الإلكتروني)، SIS (نظام معلومات الطلاب)، HR (الموارد البشرية)، أو Edumalls.', descEn: 'Choose the system where you face the issue: ERP, LMS, CPAY, SIS, HR, or Edumalls.' },
      { titleAr: 'الخطوة 2: اختيار الخدمة والتصنيف', titleEn: 'Step 2: Select Service & Category', descAr: 'اختر الموديول (مثل: إدارة المستخدمين، الفواتير، الامتحانات) ثم حدد التصنيف الفرعي (الشاشة أو الفئة المحددة).', descEn: 'Choose the module (e.g., User Management, Invoices, Exams) then specify the sub-category (specific screen or category).' },
      { titleAr: 'الخطوة 3: تعبئة التفاصيل', titleEn: 'Step 3: Fill Details', descAr: 'أدخل عنوان واضح ومحدد للمشكلة. اكتب وصفاً تفصيلياً يتضمن: ما حدث، ما كنت تتوقعه، وخطوات إعادة إنتاج المشكلة. حدد الأولوية.', descEn: 'Enter a clear, specific issue title. Write a detailed description including: what happened, what you expected, and reproduction steps. Set the priority.', noteAr: 'الأولويات: منخفض (استفسار عام)، متوسط (مشكلة تؤثر على العمل)، عالي (توقف خدمة جزئي)، عاجل (توقف خدمة كامل).', noteEn: 'Priorities: Low (general inquiry), Medium (issue affecting work), High (partial service outage), Urgent (complete service outage).' },
      { titleAr: 'الخطوة 4: إرفاق الملفات', titleEn: 'Step 4: Attach Files', descAr: 'اسحب وأفلت الملفات أو انقر لتحديدها. مدعوم: صور (PNG, JPG)، مستندات (PDF, DOCX)، وملفات مضغوطة (ZIP). الحد: 10MB لكل ملف.', descEn: 'Drag and drop files or click to select. Supported: images (PNG, JPG), documents (PDF, DOCX), and compressed files (ZIP). Limit: 10MB per file.' },
      { titleAr: 'الخطوة 5: الحقول المخصصة', titleEn: 'Step 5: Custom Fields', descAr: 'حسب الخدمة المختارة، قد تظهر حقول إضافية مخصصة (رقم الفاتورة، اسم الطالب، رقم الدورة). هذه الحقول تساعد فريق الدعم في الحل السريع.', descEn: 'Based on the selected service, additional custom fields may appear (invoice number, student name, course number). These help the support team resolve faster.' },
      { titleAr: 'الخطوة 6: المعاينة والإرسال', titleEn: 'Step 6: Preview & Submit', descAr: 'راجع ملخص التذكرة قبل الإرسال. بعد الإرسال، ستحصل على رقم تذكرة فريد (TCK-XXXX) لتتبع الطلب.', descEn: 'Review the ticket summary before submitting. After submission, you will get a unique ticket number (TCK-XXXX) to track the request.' },
    ],
    tipsAr: [
      'استخدم القوالب الجاهزة لتسريع إنشاء التذاكر المتكررة',
      'كلما كان الوصف أدق وتضمن لقطات شاشة، زادت سرعة الحل',
      'اختر الأولوية بدقة - الأولوية الخاطئة قد تؤخر المعالجة',
    ],
    tipsEn: [
      'Use ready-made templates to speed up creating recurring tickets',
      'The more detailed the description with screenshots, the faster the resolution',
      'Choose priority carefully - wrong priority may delay processing',
    ],
    warningsAr: ['لا تُنشئ تذاكر مكررة لنفس المشكلة - تابع التذكرة الأصلية بدلاً من ذلك'],
    warningsEn: ['Do not create duplicate tickets for the same issue - follow up on the original ticket instead'],
  },
  {
    id: 'ticket-lifecycle',
    titleAr: 'دورة حياة التذكرة الكاملة',
    titleEn: 'Complete Ticket Lifecycle',
    icon: Workflow,
    category: 'tickets',
    descAr: 'فهم المراحل السبع التي تمر بها التذكرة من الإنشاء حتى الإغلاق.',
    descEn: 'Understand the seven stages a ticket goes through from creation to closure.',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    steps: [
      { titleAr: '1️⃣ جديدة (New)', titleEn: '1️⃣ New', descAr: 'التذكرة المُنشأة حديثاً. تنتظر مراجعة المدير وتعيينها لوكيل دعم مناسب. يبدأ عداد SLA للاستجابة الأولى.', descEn: 'Newly created ticket. Awaits manager review and assignment to an appropriate support agent. SLA first response timer starts.' },
      { titleAr: '2️⃣ مفتوحة (Open)', titleEn: '2️⃣ Open', descAr: 'تم تعيين الوكيل وبدأ مراجعة التذكرة. الوكيل يدرس المشكلة ويجمع المعلومات اللازمة.', descEn: 'Agent assigned and started reviewing the ticket. The agent studies the issue and gathers necessary information.' },
      { titleAr: '3️⃣ قيد التنفيذ (In Progress)', titleEn: '3️⃣ In Progress', descAr: 'الوكيل يعمل فعلياً على حل المشكلة. يمكن تتبع الوقت المستغرق عبر المؤقت المدمج.', descEn: 'The agent is actively working on solving the issue. Time spent can be tracked via the built-in timer.' },
      { titleAr: '4️⃣ بانتظار العميل (Waiting)', titleEn: '4️⃣ Waiting on Customer', descAr: 'التذكرة معلقة بانتظار رد أو معلومات إضافية من مقدم الطلب. عداد SLA يتوقف مؤقتاً في هذه الحالة.', descEn: 'Ticket suspended awaiting a response or additional information from the requester. SLA timer pauses in this state.', noteAr: 'يُرجى الرد في أسرع وقت لتسريع حل المشكلة.', noteEn: 'Please respond as soon as possible to speed up resolution.' },
      { titleAr: '5️⃣ تم الحل (Resolved)', titleEn: '5️⃣ Resolved', descAr: 'الوكيل أكمل حل المشكلة وأضاف ملخص الحل. يمكنك تأكيد الحل أو إعادة فتح التذكرة إذا لم تكن راضياً.', descEn: 'Agent completed the resolution and added a resolution summary. You can confirm or reopen the ticket if unsatisfied.' },
      { titleAr: '6️⃣ معاد فتحها (Reopened)', titleEn: '6️⃣ Reopened', descAr: 'مقدم الطلب أعاد فتح التذكرة لعدم رضاه عن الحل. تعود للوكيل المعين لمراجعة إضافية.', descEn: 'Requester reopened the ticket due to dissatisfaction. Returns to the assigned agent for further review.' },
      { titleAr: '7️⃣ مغلقة (Closed)', titleEn: '7️⃣ Closed', descAr: 'التذكرة أُغلقت نهائياً بعد تأكيد الحل. يظهر ويدجت تقييم CSAT لقياس رضا العميل.', descEn: 'Ticket permanently closed after confirming the resolution. A CSAT rating widget appears to measure customer satisfaction.' },
    ],
  },
  {
    id: 'ticket-management',
    titleAr: 'إدارة التذاكر المتقدمة',
    titleEn: 'Advanced Ticket Management',
    icon: Inbox,
    category: 'tickets',
    descAr: 'أدوات متقدمة لإدارة التذاكر بكفاءة عالية.',
    descEn: 'Advanced tools for highly efficient ticket management.',
    steps: [
      { titleAr: 'صندوق الوارد الذكي', titleEn: 'Smart Inbox', descAr: 'يعرض جميع التذاكر مع فلاتر متقدمة: حسب الحالة (7 حالات)، الأولوية (4 مستويات)، القسم، النظام المصدر، الوكيل المعين، والنطاق الزمني. يدعم البحث النصي الشامل.', descEn: 'Displays all tickets with advanced filters: by status (7 states), priority (4 levels), department, source system, assigned agent, and date range. Supports full-text search.' },
      { titleAr: 'أوضاع العرض المتعددة', titleEn: 'Multiple View Modes', descAr: 'بدّل بين عرض الجدول التفصيلي (مع أعمدة قابلة للفرز) وعرض البطاقات الكنبان (مصنف حسب الحالة). كل وضع يعرض المعلومات الأهم.', descEn: 'Switch between detailed table view (with sortable columns) and Kanban card view (classified by status). Each mode shows the most important information.' },
      { titleAr: 'الفلاتر المحفوظة', titleEn: 'Saved Filters', descAr: 'احفظ مجموعات الفلاتر المستخدمة بشكل متكرر لإعادة تطبيقها بنقرة واحدة. مثال: "التذاكر العاجلة في قسمي".', descEn: 'Save frequently used filter sets to reapply with one click. Example: "Urgent tickets in my department".' },
      { titleAr: 'تفاصيل التذكرة', titleEn: 'Ticket Details', descAr: 'صفحة تفاصيل شاملة تتضمن: المحادثة (تعليقات عامة وملاحظات خاصة)، المرفقات، سجل التغييرات (Audit Log)، مسار الموافقات، وتتبع الوقت.', descEn: 'Comprehensive detail page includes: conversation (public comments and private notes), attachments, change log (Audit Log), approval path, and time tracking.' },
      { titleAr: 'تتبع الوقت', titleEn: 'Time Tracking', descAr: 'مؤقت مدمج لتسجيل الوقت المستغرق في كل تذكرة. ابدأ/أوقف المؤقت أو أدخل الوقت يدوياً مع وصف للعمل المنجز.', descEn: 'Built-in timer to record time spent on each ticket. Start/stop the timer or enter time manually with a description of work done.' },
      { titleAr: 'المساعد الذكي (AI Copilot)', titleEn: 'AI Copilot', descAr: 'مساعد ذكاء اصطناعي يقترح ردوداً جاهزة، يلخص المحادثة، يحلل مشاعر العميل، ويقترح حلولاً من قاعدة المعرفة.', descEn: 'AI assistant that suggests ready responses, summarizes conversation, analyzes customer sentiment, and suggests solutions from knowledge base.' },
      { titleAr: 'تصدير التذكرة PDF', titleEn: 'Export Ticket PDF', descAr: 'صدّر تفاصيل أي تذكرة كملف PDF احترافي يتضمن جميع المعلومات والمحادثات والمرفقات.', descEn: 'Export any ticket details as a professional PDF file including all information, conversations, and attachments.' },
    ],
    tipsAr: [
      'استخدم الملاحظات الخاصة (Private Notes) للتواصل مع الفريق دون أن يرى العميل',
      'فعّل التحديثات الفورية (Live) لمتابعة التذاكر الجديدة لحظياً',
    ],
    tipsEn: [
      'Use Private Notes to communicate with the team without the customer seeing',
      'Enable Live updates to follow new tickets in real-time',
    ],
  },
  {
    id: 'ticket-templates',
    titleAr: 'قوالب التذاكر',
    titleEn: 'Ticket Templates',
    icon: FileText,
    category: 'tickets',
    descAr: 'قوالب جاهزة لتسريع إنشاء التذاكر المتكررة.',
    descEn: 'Ready-made templates to speed up creating recurring tickets.',
    steps: [
      { titleAr: 'إنشاء قالب', titleEn: 'Create Template', descAr: 'أنشئ قالباً بعنوان ووصف ونظام وخدمة وأولوية محددة مسبقاً. يمكن مشاركته مع الفريق.', descEn: 'Create a template with a pre-set title, description, system, service, and priority. Can be shared with the team.' },
      { titleAr: 'استخدام القالب', titleEn: 'Use Template', descAr: 'عند إنشاء تذكرة جديدة، اختر من القوالب المتاحة لملء النموذج تلقائياً. يمكنك تعديل أي حقل قبل الإرسال.', descEn: 'When creating a new ticket, choose from available templates to auto-fill the form. You can modify any field before submitting.' },
    ],
  },

  // ======= ADMIN =======
  {
    id: 'service-catalog',
    titleAr: 'كتالوج الخدمات والأنظمة',
    titleEn: 'Service Catalog & Systems',
    icon: FolderOpen,
    category: 'admin',
    descAr: 'الهيكل التنظيمي للأنظمة والخدمات والتصنيفات التي يبنى عليها نظام التذاكر.',
    descEn: 'The organizational structure of systems, services, and categories on which the ticketing system is built.',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    steps: [
      { titleAr: 'الهيكل الهرمي', titleEn: 'Hierarchical Structure', descAr: 'يعتمد النظام هيكلاً من 3 مستويات:\n• النظام (System): ERP, LMS, CPAY, SIS, HR, Edumalls\n• الخدمة (Service/Module): الموديولات داخل كل نظام\n• التصنيف (Category): الشاشات أو الفئات المحددة', descEn: 'The system uses a 3-level structure:\n• System: ERP, LMS, CPAY, SIS, HR, Edumalls\n• Service/Module: Modules within each system\n• Category: Specific screens or categories' },
      { titleAr: 'إدارة الأنظمة', titleEn: 'Manage Systems', descAr: 'أنشئ/عدّل الأنظمة المصدرية مع رمز فريد (Code)، وصف، وحالة التفعيل. تعطيل النظام يمنع إنشاء تذاكر جديدة له.', descEn: 'Create/edit source systems with unique code, description, and activation status. Disabling a system prevents new tickets.' },
      { titleAr: 'إدارة الخدمات', titleEn: 'Manage Services', descAr: 'أضف خدمات لكل نظام مع ربط سياسة SLA مخصصة وتحديد فريق الدعم الافتراضي (القسم المسؤول).', descEn: 'Add services per system with custom SLA policy and default support team (responsible department).' },
      { titleAr: 'التصنيفات الفرعية', titleEn: 'Sub-Categories', descAr: 'أنشئ تصنيفات فرعية لكل خدمة لتحديد الشاشة أو المنطقة الدقيقة في الموديول.', descEn: 'Create sub-categories per service to specify the exact screen or area in the module.' },
      { titleAr: 'الحقول المخصصة', titleEn: 'Custom Fields', descAr: 'أنشئ حقولاً مخصصة لكل خدمة (نص، رقم، قائمة منسدلة، تاريخ، خيارات متعددة). حدد ما إذا كان الحقل إجبارياً وترتيب ظهوره.', descEn: 'Create custom fields per service (text, number, dropdown, date, multi-select). Set if the field is required and its display order.' },
    ],
  },
  {
    id: 'departments-users',
    titleAr: 'إدارة الأقسام والمستخدمين',
    titleEn: 'Departments & Users',
    icon: Users,
    category: 'admin',
    descAr: 'إعداد الهيكل التنظيمي وإدارة حسابات المستخدمين وصلاحياتهم.',
    descEn: 'Set up the organizational structure and manage user accounts and their permissions.',
    steps: [
      { titleAr: 'إنشاء الأقسام', titleEn: 'Create Departments', descAr: 'أنشئ أقسام الدعم (الدعم التقني، خدمة العملاء، التطوير، إلخ) مع وصف لكل قسم.', descEn: 'Create support departments (Technical Support, Customer Service, Development, etc.) with a description for each.' },
      { titleAr: 'إدارة المستخدمين', titleEn: 'Manage Users', descAr: 'لوحة شاملة لإدارة المستخدمين تعرض: الإجمالي، النشطين، توزيع الأدوار. ابحث وصفّي حسب الدور، القسم، وحالة الحساب.', descEn: 'Comprehensive user management panel showing: total, active, role distribution. Search and filter by role, department, and account status.' },
      { titleAr: 'نظام الأدوار الأربعة', titleEn: 'Four-Role System', descAr: '• مدير (Admin): صلاحيات كاملة لجميع أجزاء النظام\n• وكيل دعم (Agent): إدارة ومعالجة التذاكر المعيّنة\n• مقدم طلب (Requester): إنشاء تذاكر ومتابعتها\n• مطوّر (Developer): وصول للتذاكر التقنية والتقارير', descEn: '• Admin: Full access to all system parts\n• Agent: Manage and process assigned tickets\n• Requester: Create and track tickets\n• Developer: Access to technical tickets and reports' },
      { titleAr: 'إنشاء مستخدم جديد', titleEn: 'Create New User', descAr: 'أضف مستخدمين بالبريد الإلكتروني وكلمة مرور مؤقتة. حدد الدور والقسم والمدير المباشر.', descEn: 'Add users with email and temporary password. Set role, department, and direct manager.' },
    ],
    warningsAr: ['تغيير دور المستخدم يؤثر فوراً على صلاحياته - تأكد قبل التغيير'],
    warningsEn: ['Changing a user role immediately affects their permissions - verify before changing'],
  },
  {
    id: 'approval-stages',
    titleAr: 'نظام الموافقات والاعتماد',
    titleEn: 'Approval & Authorization System',
    icon: ShieldCheck,
    category: 'admin',
    descAr: 'نظام موافقات متعدد المراحل مع تصعيد تلقائي ومخطط انسيابي.',
    descEn: 'Multi-stage approval system with auto-escalation and flowchart visualization.',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    steps: [
      { titleAr: 'تصميم المراحل', titleEn: 'Design Stages', descAr: 'حدد مراحل الاعتماد لكل قسم وخدمة. اختر نوع المرحلة:\n• تسلسلي (Sequential): الموافقات تتم بالترتيب\n• متوازي (Parallel): يمكن الموافقة من أي معتمد', descEn: 'Define approval stages per department and service. Choose stage type:\n• Sequential: Approvals happen in order\n• Parallel: Any approver can approve' },
      { titleAr: 'تعيين المعتمدين', titleEn: 'Assign Approvers', descAr: 'حدد المعتمد لكل مرحلة: شخص محدد أو دور (مثل: أي مدير). حدد المدة الزمنية المسموحة للموافقة.', descEn: 'Set the approver for each stage: specific person or role (e.g., any manager). Set allowed approval timeframe.' },
      { titleAr: 'المخطط الانسيابي', titleEn: 'Visual Flowchart', descAr: 'عرض مرئي تفاعلي لمسارات الموافقة يوضح التسلسل والتفرعات ومسارات التصعيد.', descEn: 'Interactive visual display of approval paths showing sequence, branches, and escalation paths.' },
      { titleAr: 'لوحة كانبان الموافقات', titleEn: 'Approval Kanban Board', descAr: 'تابع جميع الموافقات في عرض كانبان بـ 3 أعمدة: معلقة، مقبولة، مرفوضة. اسحب وأفلت للتحديث.', descEn: 'Track all approvals in a 3-column Kanban view: pending, approved, rejected. Drag and drop to update.' },
      { titleAr: 'التصعيد التلقائي', titleEn: 'Auto-Escalation', descAr: 'إذا لم يتم الرد على الموافقة خلال المهلة المحددة، يتم التصعيد تلقائياً للمسؤول الأعلى مع إشعار.', descEn: 'If the approval is not responded to within the set deadline, it auto-escalates to a higher authority with notification.' },
      { titleAr: 'تقارير الموافقات', titleEn: 'Approval Reports', descAr: 'تقارير تفصيلية عن: متوسط وقت الموافقة، نسبة الرفض، أكثر المعتمدين نشاطاً، والموافقات المتأخرة.', descEn: 'Detailed reports on: average approval time, rejection rate, most active approvers, and overdue approvals.' },
    ],
  },
  {
    id: 'sla-management',
    titleAr: 'إدارة اتفاقيات مستوى الخدمة (SLA)',
    titleEn: 'SLA Management',
    icon: Timer,
    category: 'admin',
    descAr: 'تعريف ومراقبة اتفاقيات مستوى الخدمة لضمان الالتزام بمعايير الجودة.',
    descEn: 'Define and monitor Service Level Agreements to ensure quality standards compliance.',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    steps: [
      { titleAr: 'تعريف السياسات', titleEn: 'Define Policies', descAr: 'حدد أوقات الاستجابة الأولى والحل لكل مستوى أولوية:\n• عاجل: استجابة 15 دقيقة / حل 2 ساعة\n• عالي: استجابة 1 ساعة / حل 8 ساعات\n• متوسط: استجابة 4 ساعات / حل 24 ساعة\n• منخفض: استجابة 8 ساعات / حل 48 ساعة', descEn: 'Set first response and resolution times per priority:\n• Urgent: 15min response / 2hr resolve\n• High: 1hr response / 8hr resolve\n• Medium: 4hr response / 24hr resolve\n• Low: 8hr response / 48hr resolve' },
      { titleAr: 'لوحة مراقبة الالتزام', titleEn: 'Compliance Dashboard', descAr: 'لوحة تحكم مخصصة تعرض: نسبة الالتزام الإجمالية، التذاكر المتجاوزة، التذاكر المعرضة للخطر (أقل من 25% متبقي)، وتحليل الأداء حسب القسم.', descEn: 'Dedicated dashboard showing: overall compliance rate, overdue tickets, at-risk tickets (less than 25% remaining), and performance analysis by department.' },
      { titleAr: 'مصفوفة التصعيد الأوتوماتيكية', titleEn: 'Auto-Escalation Matrix', descAr: 'نظام تصعيد من 4 مستويات:\n• L0: تنبيه الوكيل (75% من الوقت)\n• L1: إخطار مدير القسم (100%)\n• L2: رفع الأولوية تلقائياً (125%)\n• L3: تصعيد للإدارة العليا (150%)', descEn: '4-level escalation system:\n• L0: Agent alert (75% time)\n• L1: Department manager notification (100%)\n• L2: Auto-priority raise (125%)\n• L3: Senior management escalation (150%)' },
      { titleAr: 'العداد التنازلي المرئي', titleEn: 'Visual Countdown', descAr: 'شريط تقدم ملون يظهر في كل تذكرة يعرض الوقت المتبقي: أخضر (>50%)، أصفر (25-50%)، أحمر (<25%).', descEn: 'Colored progress bar shown on each ticket displaying remaining time: green (>50%), yellow (25-50%), red (<25%).' },
    ],
    tipsAr: ['اربط سياسات SLA بالخدمات لتطبيق أوقات مختلفة حسب نوع الخدمة'],
    tipsEn: ['Link SLA policies to services to apply different times per service type'],
  },
  {
    id: 'automation',
    titleAr: 'محرك قواعد الأتمتة',
    titleEn: 'Automation Rules Engine',
    icon: Zap,
    category: 'admin',
    descAr: 'أتمتة العمليات المتكررة لتوفير الوقت وتقليل الأخطاء البشرية.',
    descEn: 'Automate repetitive processes to save time and reduce human errors.',
    steps: [
      { titleAr: 'بناء القاعدة', titleEn: 'Build Rule', descAr: 'أنشئ قاعدة أتمتة بتحديد: الاسم والوصف، الحدث المُشغّل (إنشاء تذكرة، تغيير حالة، تغيير أولوية)، الشروط (حسب الأولوية، القسم، النظام)، والإجراءات.', descEn: 'Create an automation rule by defining: name and description, trigger event (ticket created, status changed, priority changed), conditions (by priority, department, system), and actions.' },
      { titleAr: 'أنواع الإجراءات', titleEn: 'Action Types', descAr: '• تعيين وكيل تلقائياً\n• تغيير الأولوية\n• إرسال إشعار\n• تحويل القسم\n• إضافة تعليق تلقائي\n• تغيير الحالة', descEn: '• Auto-assign agent\n• Change priority\n• Send notification\n• Transfer department\n• Add auto-comment\n• Change status' },
      { titleAr: 'مراقبة التنفيذ', titleEn: 'Monitor Execution', descAr: 'تتبع سجل تنفيذ كل قاعدة: عدد مرات التنفيذ، آخر تنفيذ، نسبة النجاح، ورسائل الأخطاء إن وجدت.', descEn: 'Track execution log per rule: execution count, last run, success rate, and error messages if any.' },
      { titleAr: 'أمثلة عملية', titleEn: 'Practical Examples', descAr: '✅ قاعدة 1: عند إنشاء تذكرة عاجلة → تعيين لأقدم وكيل متاح + إشعار المدير\n✅ قاعدة 2: عند تغيير الحالة لـ"محلول" → إرسال بريد للعميل بملخص الحل\n✅ قاعدة 3: تذكرة من نظام CPAY → تحويل لقسم المدفوعات تلقائياً', descEn: '✅ Rule 1: On urgent ticket creation → assign to most senior available agent + notify manager\n✅ Rule 2: On status change to "Resolved" → send email to customer with resolution summary\n✅ Rule 3: Ticket from CPAY system → auto-transfer to payments department' },
    ],
    warningsAr: ['اختبر القواعد على تذاكر محدودة قبل تفعيلها لجميع التذاكر لتجنب التأثيرات غير المقصودة'],
    warningsEn: ['Test rules on limited tickets before enabling for all tickets to avoid unintended effects'],
  },
  {
    id: 'canned-responses',
    titleAr: 'الردود الجاهزة',
    titleEn: 'Canned Responses',
    icon: MessageCircle,
    category: 'admin',
    descAr: 'مكتبة ردود معدة مسبقاً لتسريع التواصل مع العملاء.',
    descEn: 'A library of pre-built responses to speed up customer communication.',
    steps: [
      { titleAr: 'إنشاء ردود', titleEn: 'Create Responses', descAr: 'أنشئ ردوداً جاهزة مع عنوان وتصنيف ومحتوى. أضف اختصاراً للوصول السريع (مثل: /welcome).', descEn: 'Create ready responses with title, category, and content. Add a shortcut for quick access (e.g., /welcome).' },
      { titleAr: 'المشاركة مع الفريق', titleEn: 'Share with Team', descAr: 'اختر إن كان الرد خاصاً (لك فقط) أو مشتركاً (متاح لجميع الوكلاء).', descEn: 'Choose if the response is private (only you) or shared (available to all agents).' },
      { titleAr: 'الاستخدام السريع', titleEn: 'Quick Use', descAr: 'في نافذة التعليق، اكتب / متبوعاً بالاختصار أو ابحث في قائمة الردود المتاحة.', descEn: 'In the comment window, type / followed by the shortcut or search in the available responses list.' },
    ],
  },
  {
    id: 'tenants',
    titleAr: 'إدارة المستأجرين (Multi-Tenant)',
    titleEn: 'Tenant Management (Multi-Tenant)',
    icon: Building2,
    category: 'admin',
    descAr: 'نظام متعدد المستأجرين يتيح إنشاء كيانات مستقلة مع هوية بصرية مخصصة.',
    descEn: 'Multi-tenant system allowing creation of independent entities with custom branding.',
    steps: [
      { titleAr: 'إنشاء مستأجر', titleEn: 'Create Tenant', descAr: 'أنشئ كيان (مستأجر) جديد بتحديد: الاسم، المعرف الفريد (Slug)، الخطة (مجاني/أساسي/احترافي/مؤسسي)، حد المستخدمين، وحد التذاكر الشهرية.', descEn: 'Create a new tenant with: name, unique slug, plan (free/basic/pro/enterprise), user limit, and monthly ticket limit.' },
      { titleAr: 'الهوية البصرية (White-Label)', titleEn: 'White-Label Branding', descAr: 'خصص لكل مستأجر: الشعار (Logo)، اللون الأساسي والثانوي، أيقونة المفضلة (Favicon)، والنطاق المخصص (Custom Domain).', descEn: 'Customize for each tenant: Logo, primary and secondary colors, Favicon, and Custom Domain.' },
      { titleAr: 'إدارة الأعضاء', titleEn: 'Manage Members', descAr: 'أضف أعضاء للمستأجر وحدد أدوارهم: مالك (Owner) أو عضو (Member). المالك لديه صلاحيات إدارة كاملة.', descEn: 'Add members to tenant with roles: Owner or Member. Owner has full management permissions.' },
      { titleAr: 'معاينة الهوية', titleEn: 'Branding Preview', descAr: 'شاهد معاينة مباشرة لكيف سيظهر النظام بالهوية البصرية المحددة قبل الحفظ.', descEn: 'See a live preview of how the system will look with the specified branding before saving.' },
    ],
  },
  {
    id: 'settings',
    titleAr: 'إعدادات النظام',
    titleEn: 'System Settings',
    icon: Settings,
    category: 'admin',
    descAr: 'إعدادات عامة للنظام تؤثر على جميع المستخدمين.',
    descEn: 'General system settings that affect all users.',
    steps: [
      { titleAr: 'الإعدادات العامة', titleEn: 'General Settings', descAr: 'عدّل اسم النظام، العنوان الفرعي، شعار النظام. هذه التغييرات تظهر في الشريط الجانبي والرأسية لجميع المستخدمين.', descEn: 'Edit system name, subtitle, logo. These changes appear in the sidebar and header for all users.' },
      { titleAr: 'إدارة البريد الإلكتروني', titleEn: 'Email Management', descAr: 'تحكم في إعدادات إشعارات البريد الإلكتروني: تفعيل/تعطيل أنواع محددة، تعديل قوالب الرسائل، وإرسال رسائل جماعية.', descEn: 'Control email notification settings: enable/disable specific types, edit message templates, and send broadcast messages.' },
    ],
  },

  // ======= REPORTS =======
  {
    id: 'reports-analytics',
    titleAr: 'التقارير والتحليلات المتقدمة',
    titleEn: 'Advanced Reports & Analytics',
    icon: BarChart3,
    category: 'reports',
    descAr: 'مجموعة شاملة من التقارير والرسوم البيانية لتحليل أداء النظام واتخاذ قرارات مبنية على البيانات.',
    descEn: 'A comprehensive set of reports and charts to analyze system performance and make data-driven decisions.',
    steps: [
      { titleAr: 'لوحة المدير التنفيذي', titleEn: 'Executive Dashboard', descAr: 'نظرة عامة رفيعة المستوى تعرض: إجمالي التذاكر، معدل الحل، متوسط وقت الاستجابة، نسبة الالتزام بـSLA، توزيع حسب الأولوية والحالة، ومقارنة الأداء الزمنية.', descEn: 'High-level overview showing: total tickets, resolution rate, avg response time, SLA compliance rate, priority/status distribution, and time-based performance comparison.' },
      { titleAr: 'أداء الوكلاء', titleEn: 'Agent Performance', descAr: 'لكل وكيل: عدد التذاكر المعالجة، متوسط وقت الحل، تقييم CSAT، نسبة الالتزام بـSLA. مع ترتيب وجوائز لأفضل الأداء.', descEn: 'Per agent: processed tickets, avg resolution time, CSAT rating, SLA compliance. With ranking and awards for best performance.' },
      { titleAr: 'تحليلات CSAT', titleEn: 'CSAT Analytics', descAr: 'تتبع رضا العملاء: متوسط التقييمات، توزيع النجوم، اتجاهات الرضا الزمنية، وأفضل/أسوأ الخدمات تقييماً.', descEn: 'Track customer satisfaction: average ratings, star distribution, satisfaction trends, and best/worst rated services.' },
      { titleAr: 'التزام SLA', titleEn: 'SLA Compliance', descAr: 'تقارير تفصيلية: نسبة الالتزام حسب القسم والخدمة والأولوية، التذاكر المتجاوزة مع تفاصيل التأخير.', descEn: 'Detailed reports: compliance by department, service, and priority, overdue tickets with delay details.' },
      { titleAr: 'منشئ التقارير المخصصة', titleEn: 'Custom Report Builder', descAr: 'أنشئ تقارير مخصصة باختيار: الأبعاد (القسم، النظام، الوكيل)، المقاييس (العدد، المتوسط، النسبة)، الفلاتر، ونوع الرسم البياني. مع إمكانية التصدير.', descEn: 'Create custom reports by choosing: dimensions (department, system, agent), metrics (count, average, percentage), filters, and chart type. With export capability.' },
    ],
  },
  {
    id: 'audit-log',
    titleAr: 'سجل المراجعة والتتبع',
    titleEn: 'Audit Log & Tracking',
    icon: FileSearch,
    category: 'reports',
    descAr: 'سجل شامل لجميع العمليات والتغييرات في النظام لأغراض الرقابة والامتثال.',
    descEn: 'Comprehensive log of all operations and changes for governance and compliance.',
    steps: [
      { titleAr: 'أنواع الأحداث', titleEn: 'Event Types', descAr: 'يسجّل 10 أنواع: إنشاء تذكرة، تغيير حالة، تعيين وكيل، تغيير أولوية، تغيير قسم، إضافة تعليق، إرفاق ملف، حل، إغلاق، إعادة فتح.', descEn: 'Logs 10 types: ticket creation, status change, agent assignment, priority change, department change, comment added, file attached, resolved, closed, reopened.' },
      { titleAr: 'البحث والفلترة', titleEn: 'Search & Filter', descAr: 'ابحث حسب: المستخدم المنفذ، رقم التذكرة، نوع الحدث، النطاق الزمني. مع عرض القيمة القديمة والجديدة لكل تغيير.', descEn: 'Search by: executing user, ticket number, event type, date range. Shows old and new values for each change.' },
    ],
  },

  // ======= INTEGRATIONS =======
  {
    id: 'classera-integration',
    titleAr: 'تكامل كلاسيرا الشامل',
    titleEn: 'Classera Integration',
    icon: Plug,
    category: 'integrations',
    descAr: 'ربط أنظمة كلاسيرا لاستقبال وإرسال التذاكر تلقائياً مع مزامنة ثنائية الاتجاه.',
    descEn: 'Connect Classera systems for automatic ticket reception and sending with bidirectional sync.',
    steps: [
      { titleAr: 'الأنظمة المدعومة', titleEn: 'Supported Systems', descAr: '6 أنظمة مدعومة: ERP (إدارة الموارد)، LMS (إدارة التعلم)، CPAY (الدفع)، SIS (معلومات الطلاب)، HR (الموارد البشرية)، Edumalls (المتجر التعليمي).', descEn: '6 supported systems: ERP, LMS, CPAY, SIS, HR, Edumalls.' },
      { titleAr: 'إعداد التكامل', titleEn: 'Setup Integration', descAr: 'حدد نقطة اتصال API ومفتاح المصادقة لكل نظام. اختبر الاتصال قبل التفعيل.', descEn: 'Specify API endpoint and authentication key for each system. Test connection before activation.' },
      { titleAr: 'اتجاه المزامنة', titleEn: 'Sync Direction', descAr: '3 خيارات: وارد فقط (استقبال تذاكر)، صادر فقط (إرسال تحديثات)، ثنائي الاتجاه (كلا الاتجاهين).', descEn: '3 options: inbound only (receive tickets), outbound only (send updates), bidirectional (both ways).' },
      { titleAr: 'مراقبة المزامنة', titleEn: 'Monitor Sync', descAr: 'تتبع لحظي لحالة المزامنة: عدد التذاكر المستلمة والمرسلة، آخر مزامنة ناجحة، رسائل الأخطاء.', descEn: 'Real-time sync status tracking: received/sent ticket count, last successful sync, error messages.' },
    ],
  },
  {
    id: 'channels',
    titleAr: 'قنوات التواصل المتعددة',
    titleEn: 'Omni-Channel Communication',
    icon: Globe,
    category: 'integrations',
    descAr: 'استقبال وإرسال الرسائل عبر قنوات متعددة مع ربطها بالتذاكر.',
    descEn: 'Receive and send messages across multiple channels with ticket linking.',
    steps: [
      { titleAr: 'واتساب بيزنس', titleEn: 'WhatsApp Business', descAr: 'استقبل رسائل واتساب من العملاء وأنشئ تذاكر تلقائياً. أرسل ردوداً وتحديثات مباشرة من التذكرة.', descEn: 'Receive WhatsApp messages from customers and auto-create tickets. Send replies and updates directly from the ticket.' },
      { titleAr: 'تكامل سلاك', titleEn: 'Slack Integration', descAr: 'أرسل إشعارات التذاكر لقنوات سلاك مع أزرار تفاعلية للموافقة أو التعيين مباشرة من سلاك.', descEn: 'Send ticket notifications to Slack channels with interactive buttons for approval or assignment directly from Slack.' },
      { titleAr: 'البريد الإلكتروني', titleEn: 'Email', descAr: 'إشعارات بريد إلكتروني مصممة احترافياً لكل نوع حدث. قابلة للتخصيص وتدعم HTML. مع إرسال رسائل جماعية.', descEn: 'Professionally designed email notifications for each event type. Customizable and HTML-supported. With broadcast messaging.' },
    ],
  },
  {
    id: 'webhooks-api',
    titleAr: 'الويب هوكس و API الخارجي',
    titleEn: 'Webhooks & External API',
    icon: Webhook,
    category: 'integrations',
    descAr: 'نقاط اتصال للتكامل مع أنظمة خارجية واستقبال التذاكر عبر API.',
    descEn: 'Connection points for integration with external systems and receiving tickets via API.',
    steps: [
      { titleAr: 'إنشاء ويب هوك', titleEn: 'Create Webhook', descAr: 'أنشئ نقطة اتصال بتحديد: URL الوجهة، الأحداث المُشغّلة (إنشاء/تحديث/حل/إغلاق)، الرؤوس المخصصة (Headers)، ومفتاح التوقيع (Secret).', descEn: 'Create endpoint with: destination URL, trigger events (create/update/resolve/close), custom headers, and signing secret.' },
      { titleAr: 'واجهة API الخارجية', titleEn: 'External API', descAr: 'API مُوثّق لاستقبال تذاكر من أنظمة خارجية. يدعم المصادقة عبر API Key مع payload مخصص.', descEn: 'Documented API for receiving tickets from external systems. Supports API Key authentication with custom payload.' },
      { titleAr: 'سجل الطلبات', titleEn: 'Request Log', descAr: 'سجل لجميع الطلبات المرسلة/المستلمة مع حالة الاستجابة ومحتوى الطلب لتسهيل التشخيص.', descEn: 'Log of all sent/received requests with response status and request content for easy diagnosis.' },
    ],
  },

  // ======= SECURITY =======
  {
    id: 'security',
    titleAr: 'الأمان والحوكمة',
    titleEn: 'Security & Governance',
    icon: Shield,
    category: 'security',
    descAr: 'طبقات أمان متعددة لحماية البيانات والتحكم في الوصول.',
    descEn: 'Multiple security layers for data protection and access control.',
    steps: [
      { titleAr: 'لوحة الأمان', titleEn: 'Security Dashboard', descAr: 'نظرة عامة شاملة: المستخدمين النشطين، محاولات تسجيل الدخول الفاشلة، الجلسات المشبوهة، والتنبيهات الأمنية.', descEn: 'Comprehensive overview: active users, failed login attempts, suspicious sessions, and security alerts.' },
      { titleAr: 'التحكم في الوصول (RLS)', titleEn: 'Access Control (RLS)', descAr: 'سياسات أمان على مستوى الصف (Row-Level Security) تضمن:\n• مقدم الطلب يرى تذاكره فقط\n• الوكيل يرى تذاكر قسمه\n• المطور يرى التذاكر المرتبطة بأنظمته\n• المدير يرى كل شيء', descEn: 'Row-Level Security policies ensure:\n• Requester sees only their tickets\n• Agent sees their department tickets\n• Developer sees tickets linked to their systems\n• Admin sees everything' },
      { titleAr: 'سياسات كلمة المرور', titleEn: 'Password Policies', descAr: 'تحكم في: الحد الأدنى للطول، متطلبات التعقيد (أحرف كبيرة/صغيرة/أرقام/رموز)، وفترة انتهاء الصلاحية.', descEn: 'Control: minimum length, complexity requirements (upper/lower/numbers/symbols), and expiration period.' },
      { titleAr: 'مراقبة النظام', titleEn: 'System Monitoring', descAr: 'مراقبة حية لأداء النظام: زمن الاستجابة، معدل الأخطاء، استخدام الموارد، وحالة الخدمات.', descEn: 'Live system monitoring: response time, error rate, resource usage, and service status.' },
    ],
    warningsAr: ['لا تشارك بيانات تسجيل الدخول مع أي شخص - كل مستخدم يجب أن يكون له حساب خاص'],
    warningsEn: ['Never share login credentials with anyone - each user must have their own account'],
  },
];

const categoryConfig: Record<Category, { labelAr: string; labelEn: string; icon: any; gradient: string; bgColor: string }> = {
  basics: { labelAr: 'الأساسيات', labelEn: 'Basics', icon: BookOpen, gradient: 'from-primary/20 to-primary/5', bgColor: 'bg-primary/10 text-primary' },
  tickets: { labelAr: 'إدارة التذاكر', labelEn: 'Tickets', icon: Inbox, gradient: 'from-blue-500/20 to-blue-500/5', bgColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  admin: { labelAr: 'الإدارة', labelEn: 'Admin', icon: Settings, gradient: 'from-amber-500/20 to-amber-500/5', bgColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  reports: { labelAr: 'التقارير', labelEn: 'Reports', icon: BarChart3, gradient: 'from-emerald-500/20 to-emerald-500/5', bgColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  integrations: { labelAr: 'التكاملات', labelEn: 'Integrations', icon: Plug, gradient: 'from-purple-500/20 to-purple-500/5', bgColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  security: { labelAr: 'الأمان', labelEn: 'Security', icon: Shield, gradient: 'from-rose-500/20 to-rose-500/5', bgColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
};

// ===================== COMPONENT =====================
export default function SystemGuide() {
  const { lang, isRTL } = useLanguage();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const filteredSections = useMemo(() => {
    let sections = guideSections;
    if (activeTab !== 'all') sections = sections.filter(s => s.category === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      sections = sections.filter(s => {
        const title = lang === 'ar' ? s.titleAr : s.titleEn;
        const desc = lang === 'ar' ? (s.descAr || '') : (s.descEn || '');
        const stepsText = s.steps.map(st => `${lang === 'ar' ? st.titleAr : st.titleEn} ${lang === 'ar' ? st.descAr : st.descEn}`).join(' ');
        return title.toLowerCase().includes(q) || desc.toLowerCase().includes(q) || stepsText.toLowerCase().includes(q);
      });
    }
    return sections;
  }, [search, activeTab, lang]);

  const totalSteps = guideSections.reduce((a, s) => a + s.steps.length, 0);
  const totalTips = guideSections.reduce((a, s) => a + ((lang === 'ar' ? s.tipsAr : s.tipsEn)?.length || 0), 0);
  const totalVideos = guideSections.filter(s => s.videoUrl).length;

  const handleExportPDF = () => {
    setExporting(true);
    try {
      const sections = guideSections;
      const html = `<!DOCTYPE html>
<html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${lang}">
<head>
<meta charset="utf-8">
<title>${lang === 'ar' ? 'دليل النظام الشامل - Ticket-X' : 'Comprehensive System Guide - Ticket-X'}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Tajawal','Segoe UI',Arial,sans-serif;color:#1a1a2e;padding:0;direction:${isRTL ? 'rtl' : 'ltr'};background:#fff;font-size:13px;line-height:1.7}
.cover{height:100vh;background:linear-gradient(135deg,#0f766e 0%,#115e59 50%,#134e4a 100%);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;page-break-after:always}
.cover h1{font-size:42px;font-weight:800;margin-bottom:12px}
.cover p{font-size:18px;opacity:0.8}
.cover .date{margin-top:24px;font-size:14px;opacity:0.6;border-top:1px solid rgba(255,255,255,0.2);padding-top:16px}
.toc{page-break-after:always;padding:40px}
.toc h2{font-size:24px;color:#0f766e;margin-bottom:24px;border-bottom:3px solid #0f766e;padding-bottom:8px}
.toc-item{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dotted #ddd;font-size:13px}
.toc-cat{font-weight:700;color:#0f766e;margin-top:16px;margin-bottom:4px;font-size:15px}
.page{padding:40px;page-break-inside:avoid}
.section{margin-bottom:32px;page-break-inside:avoid}
.section-header{display:flex;align-items:center;gap:12px;margin-bottom:12px;padding:12px 16px;background:linear-gradient(135deg,#f0fdfa,#ecfdf5);border-radius:12px;border-right:4px solid #0f766e}
.section-header h3{font-size:18px;font-weight:700;color:#134e4a}
.section-desc{font-size:12px;color:#666;margin-bottom:12px;padding:0 16px}
.step{display:flex;gap:12px;margin-bottom:8px;padding:8px 16px}
.step-num{width:28px;height:28px;border-radius:50%;background:#0f766e;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
.step-content h4{font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:2px}
.step-content p{font-size:11px;color:#555;white-space:pre-wrap}
.step-note{font-size:10px;color:#0f766e;margin-top:4px;padding:4px 8px;background:#f0fdfa;border-radius:6px;display:inline-block}
.tips{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;margin:8px 16px 8px}
.tips h4{font-size:12px;color:#92400e;margin-bottom:6px}
.tips li{font-size:11px;color:#78350f;margin-bottom:3px}
.warnings{background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px 16px;margin:8px 16px 8px}
.warnings h4{font-size:12px;color:#991b1b;margin-bottom:6px}
.warnings li{font-size:11px;color:#7f1d1d;margin-bottom:3px}
.footer{text-align:center;color:#aaa;font-size:10px;margin-top:30px;padding-top:12px;border-top:1px solid #e5e7eb}
@media print{body{padding:0}.cover{height:100vh}}
</style>
</head>
<body>
<div class="cover">
<h1>📖 ${lang === 'ar' ? 'دليل النظام الشامل' : 'System Guide'}</h1>
<p>Ticket-X ${lang === 'ar' ? 'منصة الدعم الفني المتكاملة' : 'Integrated Support Platform'}</p>
<div class="date">${lang === 'ar' ? 'الإصدار' : 'Version'} 2.0 • ${new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
</div>

<div class="toc">
<h2>${lang === 'ar' ? 'فهرس المحتويات' : 'Table of Contents'}</h2>
${Object.entries(categoryConfig).map(([key, config]) => {
  const catSections = sections.filter(s => s.category === key);
  if (!catSections.length) return '';
  return `<div class="toc-cat">${lang === 'ar' ? config.labelAr : config.labelEn}</div>
${catSections.map((s, i) => `<div class="toc-item"><span>${lang === 'ar' ? s.titleAr : s.titleEn}</span><span>${s.steps.length} ${lang === 'ar' ? 'خطوة' : 'steps'}</span></div>`).join('')}`;
}).join('')}
</div>

<div class="page">
${sections.map(s => {
  const tips = lang === 'ar' ? s.tipsAr : s.tipsEn;
  const warnings = lang === 'ar' ? s.warningsAr : s.warningsEn;
  return `<div class="section">
<div class="section-header"><h3>${lang === 'ar' ? s.titleAr : s.titleEn}</h3></div>
${(lang === 'ar' ? s.descAr : s.descEn) ? `<div class="section-desc">${lang === 'ar' ? s.descAr : s.descEn}</div>` : ''}
${s.steps.map((st, i) => `<div class="step">
<div class="step-num">${i + 1}</div>
<div class="step-content">
<h4>${lang === 'ar' ? st.titleAr : st.titleEn}</h4>
<p>${lang === 'ar' ? st.descAr : st.descEn}</p>
${(lang === 'ar' ? st.noteAr : st.noteEn) ? `<div class="step-note">💡 ${lang === 'ar' ? st.noteAr : st.noteEn}</div>` : ''}
</div></div>`).join('')}
${tips?.length ? `<div class="tips"><h4>💡 ${lang === 'ar' ? 'نصائح' : 'Tips'}</h4><ul>${tips.map(t => `<li>✓ ${t}</li>`).join('')}</ul></div>` : ''}
${warnings?.length ? `<div class="warnings"><h4>⚠️ ${lang === 'ar' ? 'تنبيهات' : 'Warnings'}</h4><ul>${warnings.map(w => `<li>${w}</li>`).join('')}</ul></div>` : ''}
</div>`;
}).join('')}
</div>

<div class="footer">${lang === 'ar' ? 'تم إنشاء هذا الدليل بواسطة Ticket-X' : 'Generated by Ticket-X'} • ${new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}</div>
</body></html>`;

      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
        setTimeout(() => w.print(), 600);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageLayout>
      <div className="flex-1 w-full" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b border-border/40">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '32px 32px' }} />
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12 relative">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <GraduationCap className="h-6 w-6 text-primary" />
                  </div>
                  <Badge variant="secondary" className="rounded-full text-xs px-3 py-1 gap-1">
                    <Sparkles className="h-3 w-3" />
                    {lang === 'ar' ? 'الإصدار 2.0' : 'Version 2.0'}
                  </Badge>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                  {lang === 'ar' ? 'دليل النظام الشامل' : 'Comprehensive System Guide'}
                </h1>
                <p className="text-sm text-muted-foreground max-w-xl">
                  {lang === 'ar' 
                    ? 'دليلك الكامل لاستخدام جميع ميزات منصة الدعم الفني. يغطي كل قسم بالتفصيل مع أمثلة عملية وفيديوهات توضيحية.'
                    : 'Your complete guide to using all support platform features. Covers every section in detail with practical examples and tutorial videos.'}
                </p>
              </div>
              <Button onClick={handleExportPDF} disabled={exporting} className="gap-2 rounded-xl shrink-0" size="lg">
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {lang === 'ar' ? 'تحميل PDF' : 'Download PDF'}
              </Button>
            </motion.div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
              {[
                { icon: Layers, value: guideSections.length, labelAr: 'قسم في الدليل', labelEn: 'Guide Sections' },
                { icon: Hash, value: totalSteps, labelAr: 'خطوة تفصيلية', labelEn: 'Detailed Steps' },
                { icon: Video, value: totalVideos, labelAr: 'فيديو توضيحي', labelEn: 'Tutorial Videos' },
                { icon: Lightbulb, value: totalTips, labelAr: 'نصيحة مهنية', labelEn: 'Pro Tips' },
              ].map((stat, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
                  <Card className="rounded-2xl border-border/30 bg-background/60 backdrop-blur-sm">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <stat.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-xl font-bold text-foreground">{stat.value}</div>
                        <div className="text-[10px] text-muted-foreground">{lang === 'ar' ? stat.labelAr : stat.labelEn}</div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6" ref={contentRef}>
          {/* Search */}
          <div className="relative mb-6">
            <Search className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground`} />
            <Input
              placeholder={lang === 'ar' ? 'ابحث في الدليل... (مثال: SLA، إنشاء تذكرة، موافقات)' : 'Search the guide... (e.g., SLA, create ticket, approvals)'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`${isRTL ? 'pr-11' : 'pl-11'} h-12 rounded-2xl text-base border-border/40 focus:border-primary/40 bg-card`}
            />
            {search && (
              <Badge variant="secondary" className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 rounded-lg text-[10px]`}>
                {filteredSections.length} {lang === 'ar' ? 'نتيجة' : 'results'}
              </Badge>
            )}
          </div>

          {/* Category Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <ScrollArea className="w-full">
              <TabsList className="flex w-max h-auto gap-1.5 bg-muted/30 p-1.5 rounded-2xl mb-6">
                <TabsTrigger value="all" className="rounded-xl text-xs px-4 py-2.5 data-[state=active]:shadow-md">
                  <BookOpen className="h-3.5 w-3.5 me-1.5" />
                  {lang === 'ar' ? 'الكل' : 'All'}
                  <Badge variant="secondary" className="ms-1.5 rounded-full text-[9px] h-4 px-1.5">{guideSections.length}</Badge>
                </TabsTrigger>
                {Object.entries(categoryConfig).map(([key, config]) => {
                  const count = guideSections.filter(s => s.category === key).length;
                  return (
                    <TabsTrigger key={key} value={key} className="rounded-xl text-xs px-4 py-2.5 gap-1.5 data-[state=active]:shadow-md">
                      <config.icon className="h-3.5 w-3.5" />
                      {lang === 'ar' ? config.labelAr : config.labelEn}
                      <Badge variant="secondary" className="ms-1 rounded-full text-[9px] h-4 px-1.5">{count}</Badge>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </ScrollArea>

            <TabsContent value={activeTab} className="mt-0">
              <AnimatePresence mode="wait">
                {filteredSections.length === 0 ? (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-20">
                    <HelpCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
                    <p className="font-semibold text-muted-foreground">{lang === 'ar' ? 'لم يتم العثور على نتائج' : 'No results found'}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{lang === 'ar' ? 'جرب كلمات بحث مختلفة' : 'Try different search terms'}</p>
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    {filteredSections.map((section, idx) => {
                      const catConfig = categoryConfig[section.category];
                      const tips = lang === 'ar' ? section.tipsAr : section.tipsEn;
                      const warnings = lang === 'ar' ? section.warningsAr : section.warningsEn;
                      const faqs = lang === 'ar' ? section.faqAr : section.faqEn;

                      return (
                        <motion.div
                          key={section.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                        >
                          <Card className="rounded-2xl border-border/40 overflow-hidden hover:shadow-md transition-shadow">
                            <Accordion type="single" collapsible value={activeSection === section.id ? section.id : undefined} onValueChange={v => setActiveSection(v || null)}>
                              <AccordionItem value={section.id} className="border-none">
                                <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/20 transition-colors">
                                  <div className="flex items-center gap-3 text-start w-full">
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${catConfig.bgColor}`}>
                                      <section.icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-sm font-bold text-foreground">
                                          {lang === 'ar' ? section.titleAr : section.titleEn}
                                        </h3>
                                        {section.videoUrl && (
                                          <Badge variant="outline" className="text-[9px] rounded-full gap-0.5 h-4 px-1.5 border-primary/30 text-primary">
                                            <PlayCircle className="h-2.5 w-2.5" /> {lang === 'ar' ? 'فيديو' : 'Video'}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                                        {lang === 'ar' ? section.descAr : section.descEn}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1.5">
                                        <Badge variant="secondary" className="text-[9px] rounded-lg h-4 px-1.5">
                                          {lang === 'ar' ? catConfig.labelAr : catConfig.labelEn}
                                        </Badge>
                                        <span className="text-[10px] text-muted-foreground">
                                          {section.steps.length} {lang === 'ar' ? 'خطوة' : 'steps'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-5 pb-5">
                                  {/* Video embed */}
                                  {section.videoUrl && (
                                    <div className="mb-5 rounded-xl overflow-hidden bg-muted/30 border border-border/30">
                                      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40">
                                        <PlayCircle className="h-4 w-4 text-primary" />
                                        <span className="text-xs font-semibold text-foreground">
                                          {lang === 'ar' ? 'فيديو توضيحي' : 'Tutorial Video'}
                                        </span>
                                      </div>
                                      <div className="aspect-video bg-muted/20 flex items-center justify-center">
                                        <div className="text-center">
                                          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                                            <PlayCircle className="h-8 w-8 text-primary" />
                                          </div>
                                          <p className="text-xs text-muted-foreground">
                                            {lang === 'ar' ? 'الفيديو التوضيحي قيد الإعداد' : 'Tutorial video coming soon'}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Steps */}
                                  <div className="space-y-1">
                                    {section.steps.map((step, i) => (
                                      <div key={i} className="flex gap-3 group">
                                        <div className="flex flex-col items-center shrink-0">
                                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-xs font-bold flex items-center justify-center border border-primary/20 group-hover:from-primary/30 group-hover:to-primary/10 transition-colors">
                                            {i + 1}
                                          </div>
                                          {i < section.steps.length - 1 && (
                                            <div className="w-px flex-1 bg-border/50 mt-1" />
                                          )}
                                        </div>
                                        <div className="pb-4 min-w-0 flex-1">
                                          <h4 className="text-sm font-semibold text-foreground">
                                            {lang === 'ar' ? step.titleAr : step.titleEn}
                                          </h4>
                                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">
                                            {lang === 'ar' ? step.descAr : step.descEn}
                                          </p>
                                          {(lang === 'ar' ? step.noteAr : step.noteEn) && (
                                            <div className="mt-2 flex items-start gap-1.5 text-[11px] text-primary bg-primary/5 rounded-lg px-3 py-2 border border-primary/10">
                                              <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                              <span>{lang === 'ar' ? step.noteAr : step.noteEn}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Warnings */}
                                  {warnings && warnings.length > 0 && (
                                    <Card className="border-destructive/20 bg-destructive/[0.03] rounded-xl mt-4">
                                      <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                          <AlertTriangle className="h-4 w-4 text-destructive" />
                                          <span className="text-xs font-bold text-destructive">
                                            {lang === 'ar' ? 'تنبيهات مهمة' : 'Important Warnings'}
                                          </span>
                                        </div>
                                        <ul className="space-y-1.5">
                                          {warnings.map((w, i) => (
                                            <li key={i} className="flex items-start gap-2 text-xs text-destructive/80">
                                              <span className="shrink-0">⚠️</span> {w}
                                            </li>
                                          ))}
                                        </ul>
                                      </CardContent>
                                    </Card>
                                  )}

                                  {/* Tips */}
                                  {tips && tips.length > 0 && (
                                    <Card className="border-primary/20 bg-primary/[0.03] rounded-xl mt-4">
                                      <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Lightbulb className="h-4 w-4 text-primary" />
                                          <span className="text-xs font-bold text-primary">
                                            {lang === 'ar' ? 'نصائح احترافية' : 'Pro Tips'}
                                          </span>
                                        </div>
                                        <ul className="space-y-1.5">
                                          {tips.map((tip, i) => (
                                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                              <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                                              {tip}
                                            </li>
                                          ))}
                                        </ul>
                                      </CardContent>
                                    </Card>
                                  )}

                                  {/* FAQ */}
                                  {faqs && faqs.length > 0 && (
                                    <Card className="border-blue-500/20 bg-blue-500/[0.03] rounded-xl mt-4">
                                      <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                          <HelpCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                            {lang === 'ar' ? 'أسئلة شائعة' : 'FAQ'}
                                          </span>
                                        </div>
                                        <div className="space-y-3">
                                          {faqs.map((faq, i) => (
                                            <div key={i}>
                                              <p className="text-xs font-semibold text-foreground">{faq.q}</p>
                                              <p className="text-[11px] text-muted-foreground mt-1">{faq.a}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </CardContent>
                                    </Card>
                                  )}
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </AnimatePresence>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageLayout>
  );
}
