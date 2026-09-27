import { Component, type ReactNode } from 'react';
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error('Page rendering failed:', error); }
  render() {
    if (this.state.failed) return <main dir="rtl" className="min-h-screen grid place-items-center p-6"><section role="alert" className="card p-8 max-w-lg text-center"><h1 className="text-2xl font-bold mb-4">تعذر عرض الصفحة</h1><p className="mb-6">حاول إعادة تحميل الصفحة. إذا استمرت المشكلة، تواصل مع الجمعية.</p><button className="btn-primary" onClick={() => window.location.reload()}>إعادة المحاولة</button><a href="/" className="block mt-5 text-teal-700">العودة إلى الرئيسية</a></section></main>;
    return this.props.children;
  }
}
