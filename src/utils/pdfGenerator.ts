import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// A simple utility to fetch and add an Arabic font to jsPDF
async function addArabicFont(doc: jsPDF) {
  try {
    // Amiri Regular font from Google Fonts repo
    const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Regular.ttf';
    const response = await fetch(fontUrl);
    if (!response.ok) return false;
    
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    
    doc.addFileToVFS('Amiri-Regular.ttf', base64);
    doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
    return true;
  } catch (error) {
    console.error('Failed to load Arabic font', error);
    return false;
  }
}

// Simple Arabic text reshaper (since standard jsPDF doesn't shape Arabic properly)
// For a production app, a library like `arabic-persian-reshaper` is better, 
// but this is a fallback if the font doesn't auto-shape.
// Note: jsPDF with a proper Arabic font sometimes shapes it automatically depending on the version.
// We will rely on jsPDF's built-in text rendering.

interface GeneratePDFOptions {
  title: string;
  columns: string[];
  data: any[][];
  fileName: string;
  logoUrl?: string; // Optional logo
}

export const generateFinancialPDF = async ({ title, columns, data, fileName, logoUrl }: GeneratePDFOptions) => {
  // Create jsPDF instance (A4, portrait, mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Try to load the font
  await addArabicFont(doc);
  doc.setFont('Amiri');

  const pageWidth = doc.internal.pageSize.width;
  
  // Add Header and Logo
  let startY = 20;

  // Add Association Name
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  // Using right alignment for Arabic
  doc.text('جمعية عون وسند الخيرية', pageWidth / 2, startY, { align: 'center' });
  
  startY += 10;
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text(title, pageWidth / 2, startY, { align: 'center' });

  startY += 10;
  doc.setFontSize(10);
  const dateStr = `تاريخ التقرير: ${new Date().toLocaleDateString('ar-MA')}`;
  doc.text(dateStr, pageWidth - 14, startY, { align: 'right' });

  // Add Logo if provided
  if (logoUrl) {
    try {
      const response = await fetch(logoUrl);
      if (response.ok) {
        const blob = await response.blob();
        if (blob.type.startsWith('image/')) {
          const reader = new FileReader();
          const base64data = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          // Assuming it's a square-ish logo, 25x25 mm
          doc.addImage(base64data, 'PNG', 14, 10, 25, 25);
        }
      }
    } catch(e) {
       console.error('Logo failed to load', e);
    }
  }

  startY += 10;

  // Render Table
  autoTable(doc, {
    startY,
    head: [columns],
    body: data,
    styles: {
      font: 'Amiri',
      halign: 'right', // Align right for Arabic
      fontSize: 10,
    },
    headStyles: {
      fillColor: [79, 70, 229], // Indigo 600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      halign: 'right',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // Slate 50
    },
    margin: { top: 20 },
    theme: 'grid',
    didDrawPage: (data) => {
      // Footer
      const str = `صفحة ${(doc as any).internal.getNumberOfPages()}`;
      doc.setFontSize(10);
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
      doc.text(str, data.settings.margin.left, pageHeight - 10);
    },
  });

  doc.save(fileName);
};
