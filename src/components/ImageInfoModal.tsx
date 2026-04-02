import { useState } from 'react';
import { motion } from 'motion/react';
import { Info, X, Sparkles, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { Message } from '../types';

export function ImageInfoModal({ 
  message, 
  onClose,
  onRegenerate,
  availableReferenceImages
}: { 
  message: Message, 
  onClose: () => void,
  onRegenerate: (prompt: string, referenceImages?: string[]) => void,
  availableReferenceImages: { url: string, label: string }[]
}) {
  const [editedPrompt, setEditedPrompt] = useState(message.generationPrompt || '');
  const [selectedRefImages, setSelectedRefImages] = useState<string[]>(message.referenceImagesUsed || []);
  const [showRefSelector, setShowRefSelector] = useState(false);

  const toggleRefImage = (url: string) => {
    setSelectedRefImages(prev => 
      prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#f0f2f5] p-6 flex justify-between items-center border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Info size={20} className="text-emerald-600" />
            Image Generation Info
          </h2>
          <button onClick={onClose}><X size={24} /></button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-bold text-emerald-600 uppercase mb-2">Generation Prompt</label>
            <p className="text-xs text-gray-500 mb-3">This is the exact prompt the AI constructed to generate this image. You can edit it and regenerate. You can also mention characters using @Name.</p>
            <textarea 
              rows={6}
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="w-full border border-gray-200 rounded-lg focus:border-emerald-600 focus:ring-0 p-3 text-sm transition-colors resize-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-emerald-600 uppercase">Reference Images ({selectedRefImages.length})</label>
              <button 
                onClick={() => setShowRefSelector(!showRefSelector)}
                className="text-xs flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium"
              >
                <ImageIcon size={14} />
                {showRefSelector ? 'Hide Selector' : 'Change References'}
              </button>
            </div>
            
            {!showRefSelector && selectedRefImages.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {selectedRefImages.map((img, idx) => (
                  <div key={`${img?.substring(0, 20) || 'img'}-${idx}`} className="aspect-square rounded-lg overflow-hidden border border-gray-200">
                    <img src={img || undefined} alt={`Reference ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                ))}
              </div>
            )}

            {showRefSelector && (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-3">Select images to use as references for regeneration. You can choose from character avatars, base references, and past chat images.</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-60 overflow-y-auto p-1">
                  {availableReferenceImages.map((img, idx) => {
                    const isSelected = selectedRefImages.includes(img.url);
                    return (
                      <div 
                        key={idx}
                        onClick={() => toggleRefImage(img.url)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${isSelected ? 'border-emerald-500 shadow-md scale-95' : 'border-transparent hover:border-gray-300'}`}
                        title={img.label}
                      >
                        <img src={img.url} alt={img.label} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        {isSelected && (
                          <div className="absolute top-1 right-1 bg-white rounded-full text-emerald-500 shadow-sm">
                            <CheckCircle2 size={16} className="fill-current text-white" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] truncate px-1 py-0.5 text-center">
                          {img.label}
                        </div>
                      </div>
                    );
                  })}
                  {availableReferenceImages.length === 0 && (
                    <div className="col-span-full text-center py-4 text-sm text-gray-500">
                      No reference images available in this chat.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-gray-50 flex justify-end gap-3 flex-shrink-0 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">Close</button>
          <button 
            onClick={() => {
              onRegenerate(editedPrompt, selectedRefImages);
              onClose();
            }}
            className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Sparkles size={16} />
            Tweak & Regenerate
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
