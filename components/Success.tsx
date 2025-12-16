import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { getMenu } from '../services/storageService';
import { RestaurantMenu } from '../types';
import { Share2, Printer, Eye, Edit, Download, ExternalLink } from 'lucide-react';
import { translations } from '../utils/translations';

const Success: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [menu, setMenu] = useState<RestaurantMenu | null>(null);
  const [qrLabel, setQrLabel] = useState('');
  const qrRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (id) {
      getMenu(id).then((data) => {
        if (data) {
            setMenu(data);
            setQrLabel(data.name); // Default to establishment name
        }
      });
    }
  }, [id]);

  if (!menu) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const t = translations[menu.language || 'pt'];
  
  // Use slug if available, otherwise fall back to ID
  const publicPath = menu.slug ? `/m/${menu.slug}` : `/menu/${menu.id}`;
  const menuUrl = `${window.location.origin}${window.location.pathname}#${publicPath}`;
  
  // Helper to ensure protocol
  const ensureProtocol = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
  };

  // Determine actual QR URL: use Custom URL if set, otherwise use default generated URL
  const isCustomUrl = menu.customQrUrl && menu.customQrUrl.trim() !== '';
  const qrValue = isCustomUrl ? ensureProtocol(menu.customQrUrl!) : menuUrl;

  // Helper to wrap text on Canvas
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for(let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
    return currentY + lineHeight;
  };

  const downloadFlyer = async () => {
    setIsGenerating(true);
    // Note: We use the rendered QR code SVG from the screen to draw onto the canvas.
    // The rendered QR already uses `qrValue`, so we just need to grab it.
    const svg = qrRef.current?.querySelector("svg");
    
    if (menu) {
        try {
            // A4 Size at approx 200 DPI (1654 x 2339 px)
            // This provides high resolution for printing
            const width = 1654;
            const height = 2339;
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            
            if (!ctx) return;

            // 1. Fill Background
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, width, height);

            let currentY = 120;
            const centerX = width / 2;
            const margin = 100;
            const contentWidth = width - (margin * 2);

            // --- HEADER ---
            
            // Draw Logo (if exists)
            if (menu.logo) {
                await new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => {
                        const aspect = img.width / img.height;
                        const drawHeight = 250;
                        const drawWidth = drawHeight * aspect;
                        // Center logo
                        ctx.drawImage(img, centerX - (drawWidth / 2), currentY, drawWidth, drawHeight);
                        currentY += drawHeight + 50;
                        resolve(null);
                    };
                    img.src = menu.logo!;
                });
            } else {
                currentY += 50;
            }

            // Draw Establishment Name
            ctx.fillStyle = "#1e293b"; // slate-800
            ctx.textAlign = "center";
            ctx.font = "800 80px sans-serif"; // Extra bold
            currentY = wrapText(ctx, menu.name.toUpperCase(), centerX, currentY, contentWidth, 90);
            
            currentY += 20;

            // Business Type & Info
            ctx.fillStyle = "#64748b"; // slate-500
            ctx.font = "bold 35px sans-serif";
            const subheader = [menu.businessType, menu.whatsapp ? `WhatsApp: ${menu.whatsapp}` : null].filter(Boolean).join(' • ');
            ctx.fillText(subheader.toUpperCase(), centerX, currentY);
            currentY += 80;

            // Divider
            ctx.beginPath();
            ctx.moveTo(margin + 100, currentY);
            ctx.lineTo(width - margin - 100, currentY);
            ctx.strokeStyle = "#e2e8f0";
            ctx.lineWidth = 4;
            ctx.stroke();
            currentY += 80;

            // --- MENU ITEMS ---
            
            // Loop through categories
            for (const cat of menu.categories) {
                // Check for page overflow (footer space = 300)
                if (currentY > height - 300) break; 

                // Category Title
                ctx.fillStyle = "#0f172a"; // slate-900
                ctx.font = "bold 50px sans-serif";
                ctx.fillText(cat.title.toUpperCase(), centerX, currentY);
                currentY += 60;

                // Items Loop
                ctx.font = "40px sans-serif";
                
                for (const item of cat.items) {
                     if (currentY > height - 300) break;

                     // Item Name
                     ctx.fillStyle = "#334155"; // slate-700
                     ctx.font = "bold 36px sans-serif";
                     ctx.fillText(item.name, centerX, currentY);
                     currentY += 45;

                     // Description
                     if (item.description) {
                         ctx.fillStyle = "#64748b"; // slate-500
                         ctx.font = "italic 28px sans-serif";
                         currentY = wrapText(ctx, item.description, centerX, currentY, 800, 35);
                         currentY += 10;
                     }

                     // Price
                     ctx.fillStyle = "#000000";
                     ctx.font = "bold 36px sans-serif";
                     ctx.fillText(item.price, centerX, currentY);
                     currentY += 55; // Spacing after item
                }
                currentY += 40; // Spacing after category
            }

            // --- FOOTER ---
            const footerY = height - 250;
            
            // Small QR Code
            if (svg) {
                const serializer = new XMLSerializer();
                let svgData = serializer.serializeToString(svg);
                if (!svgData.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
                    svgData = svgData.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
                }
                const qrImg = new Image();
                await new Promise((resolve) => {
                    qrImg.onload = () => {
                        const qrSize = 150;
                        ctx.drawImage(qrImg, centerX - (qrSize / 2), footerY, qrSize, qrSize);
                        resolve(null);
                    };
                    qrImg.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);
                });
            }

            // Footer Text
            ctx.fillStyle = "#94a3b8";
            ctx.font = "24px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText((t.scanMenu || "Scan to view full menu").toUpperCase(), centerX, footerY + 180);
            ctx.fillText((t.poweredBy || "Powered by FlashMenu"), centerX, footerY + 215);

            // 8. Download
            const jpgFile = canvas.toDataURL("image/jpeg", 0.85);
            const downloadLink = document.createElement("a");
            downloadLink.download = `${menu.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-menu.jpg`;
            downloadLink.href = jpgFile;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

        } catch (e) {
            console.error("Error generating menu image", e);
            alert("Could not generate image");
        } finally {
            setIsGenerating(false);
        }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-6 print:p-0 print:bg-white">
      
      {/* --- Screen View (QR Generator) --- */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 print:hidden">
        
        <div className="bg-green-50 p-6 text-center border-b border-green-100">
          <h2 className="text-xl font-bold text-green-800">{t.menuReady}</h2>
          <p className="text-sm text-green-700 mt-1">{t.printHint}</p>
        </div>

        <div className="p-8 flex flex-col items-center text-center">
          {menu.logo && (
              <img src={menu.logo} alt="Logo" className="w-24 h-24 mb-4 object-contain" />
          )}
          <h3 className="text-3xl font-black text-slate-900 mb-2">{menu.name}</h3>
          
          {/* This QR Ref is used for the Download functionality */}
          <div ref={qrRef} className="bg-white p-4 rounded-xl border-4 border-slate-900 mb-6 shadow-sm flex flex-col items-center">
            {/* Using qrValue here ensures both screen and download use custom URL if present */}
            <QRCode value={qrValue} size={250} level="H" />
            {qrLabel && (
                <p className="mt-2 font-bold text-slate-900 text-center text-xl max-w-[200px] leading-tight break-words">
                    {qrLabel}
                </p>
            )}
          </div>

          <div className="w-full max-w-xs mb-6">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 text-left px-1">
                {t.qrLabel || "QR Label"}
            </label>
            <input 
                type="text"
                value={qrLabel}
                onChange={(e) => setQrLabel(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-center font-medium"
                placeholder={menu.name}
            />
          </div>

          <div className="w-full space-y-3">
            
            {/* Link Copy */}
            <div className="flex items-center gap-2 p-3 bg-slate-100 rounded-lg text-sm text-slate-600 justify-between mb-4">
               <span className="truncate flex-1 text-left">{qrValue}</span>
               <button onClick={() => navigator.clipboard.writeText(qrValue)} title="Copy Link">
                 <Share2 size={16} />
               </button>
            </div>

            {/* View/Test Link Button */}
            {isCustomUrl ? (
                 <a 
                  href={qrValue}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-full py-3 rounded-xl font-bold bg-brand-600 text-white hover:bg-brand-500 shadow-lg shadow-brand-500/20"
                >
                  <ExternalLink size={18} className="mr-2" /> {t.viewPublic || "Open Link"}
                </a>
            ) : (
                <Link 
                  to={publicPath}
                  target="_blank"
                  className="flex items-center justify-center w-full py-3 rounded-xl font-bold bg-brand-600 text-white hover:bg-brand-500 shadow-lg shadow-brand-500/20"
                >
                  <Eye size={18} className="mr-2" /> {t.viewPublic}
                </Link>
            )}

            <Link 
              to={`/editor/${menu.id}`}
              className="flex items-center justify-center w-full py-3 rounded-xl font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              <Edit size={18} className="mr-2" /> {t.editMenu}
            </Link>
            
            <div className="flex gap-2">
                <button 
                onClick={downloadFlyer}
                disabled={isGenerating}
                className="flex-1 flex items-center justify-center py-3 rounded-xl font-bold bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                {isGenerating ? (
                    <span className="animate-pulse">Generating...</span>
                ) : (
                    <><Download size={18} className="mr-2" /> {t.downloadQR || "Download Menu"}</>
                )}
                </button>
                <button 
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center py-3 rounded-xl font-bold bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                <Printer size={18} className="mr-2" /> {t.printQR}
                </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 text-center print:hidden">
         <Link to="/" className="text-slate-400 hover:text-slate-600 text-sm">
           {t.createAnother}
         </Link>
      </div>

      {/* --- Print View (Full Menu A4) --- */}
      <div className="hidden print:block w-full max-w-[210mm] mx-auto bg-white text-black p-8">
          
          {/* Print Header */}
          <div className="text-center mb-10">
              {menu.logo && <img src={menu.logo} alt="Logo" className="w-32 h-32 object-contain mx-auto mb-4" />}
              <h1 className="text-4xl font-extrabold mb-2 uppercase tracking-tight">{menu.name}</h1>
              {menu.businessType && <p className="text-sm font-bold text-gray-500 uppercase tracking-[0.2em] mb-2">{menu.businessType}</p>}
              {menu.whatsapp && <p className="text-xs text-gray-400">WhatsApp: {menu.whatsapp}</p>}
          </div>

          {/* Print Items */}
          <div className="space-y-8">
              {menu.categories.map((cat, idx) => (
                  <div key={idx} className="break-inside-avoid">
                      <h2 className="text-xl font-bold text-center border-b-2 border-black pb-2 mb-6 uppercase tracking-wider">{cat.title}</h2>
                      <div className="flex flex-col gap-4">
                          {cat.items.map((item, iIdx) => (
                              <div key={iIdx} className="text-center mb-2 px-4 break-inside-avoid">
                                  <h3 className="text-lg font-bold">{item.name}</h3>
                                  <p className="text-sm text-gray-600 italic mb-1 max-w-lg mx-auto">{item.description}</p>
                                  <div className="font-bold text-lg">{item.price}</div>
                              </div>
                          ))}
                      </div>
                  </div>
              ))}
          </div>

          {/* Print Footer */}
          <div className="text-center mt-16 pt-8 border-t border-gray-100 break-inside-avoid">
              <div className="inline-block p-2 bg-white border border-gray-200 rounded-lg">
                 <QRCode value={qrValue} size={80} />
              </div>
              <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-widest">Scan to view full digital menu</p>
              <p className="text-[10px] text-gray-300 mt-1">{t.poweredBy}</p>
          </div>
      </div>

    </div>
  );
};

export default Success;