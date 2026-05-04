# 🚀 إعداد متغيرات البيئة في Vercel (Environment Variables)

بعد إزالة Firebase، أصبح المشروع يعتمد بالكامل على **Supabase**.
لقد تم تنظيف المشروع من أي مفاتيح غير ضرورية. يجب عليك وضع المتغيرات التالية فقط في منصة Vercel.

## 📌 أين تضع هذه المتغيرات؟
1. اذهب إلى لوحة تحكم مشروعك في **Vercel**.
2. من القائمة العلوية اضغط على **Settings** (الإعدادات).
3. من القائمة الجانبية اختر **Environment Variables**.
4. قم بإضافة المفاتيح (Key) والقيم (Value) التالية:

---

### 🟢 المتغيرات العامة (Public Variables)
هذه المتغيرات ضرورية لعمل الواجهة الأمامية للموقع (Frontend).

| المفتاح (Key) | القيمة (Value) |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://your-project-id.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_bzMOKDOqC0dR8Ec_DAKZMA_13wY-oVl` |

*(تأكد من استبدال رابط المشروع برابط Supabase الفعلي الخاص بك)*

---

### 🔴 المتغيرات الخاصة بالخادم (Server-Only / Backend) - سري جداً ⚠️
هذا المفتاح يتم استخدامه في الـ Serverless Functions (لوجود مجلد `api`) للقيام بمهام الإدمن لتجاوز الـ RLS. **يجب ألا يتم استخدامه في الواجهة أبداً**.

| المفتاح (Key) | القيمة (Value) |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_8edNv_ECVLdQbNuol2NTtA_8wvucqm5` |

---

### ✅ ملاحظات إضافية:
- تم مسح **Firebase بالكامل** من الكود (الحزم، الأكواد، Service Worker، المتغيرات).
- لا تترك أي متغيرات قديمة تحمل اسم `FIREBASE_` داخل Vercel حتى لا تسبب مشاكل.
- المشروع يعتمد الآن بالكامل على **Supabase فقط** لإدارة المستخدمين، الإشعارات، قاعدة البيانات، والتخزين.
