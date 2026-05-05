-- تفعيل نظام التحديث اللحظي (Realtime) للجداول المطلوبة
-- يرجى تشغيل هذا الكود في Supabase SQL Editor لكي تعمل التحديثات الفورية عند المستخدمين وفي لوحة الإدارة

-- إضافة الجداول المطلوبة إلى قائمة البث اللحظي
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_options;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
