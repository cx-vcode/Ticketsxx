import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPTED = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv';

interface FileDropZoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

export function FileDropZone({ files, onFilesChange }: FileDropZoneProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const valid = Array.from(newFiles).filter(f => {
      if (f.size > MAX_SIZE) {
        toast({ title: `الملف "${f.name}" يتجاوز 10 ميجابايت`, variant: 'destructive' });
        return false;
      }
      return true;
    });
    if (valid.length) onFilesChange([...files, ...valid]);
  }, [files, onFilesChange, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const getIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '')) return <ImageIcon className="h-4 w-4 text-accent" />;
    return <FileText className="h-4 w-4 text-primary" />;
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED}
        className="hidden"
        onChange={e => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <motion.div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        animate={{ borderColor: isDragging ? 'hsl(var(--accent))' : 'hsl(var(--border))' }}
        className={cn(
          'relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors',
          isDragging ? 'bg-accent/5' : 'bg-muted/20 hover:bg-muted/40'
        )}
      >
        <motion.div
          animate={{ scale: isDragging ? 1.1 : 1, y: isDragging ? -4 : 0 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        </motion.div>
        <p className="text-sm font-medium text-muted-foreground">
          {isDragging ? 'أفلت الملفات هنا' : 'اسحب الملفات هنا أو اضغط للاختيار'}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">الحد الأقصى 10 ميجابايت لكل ملف</p>
      </motion.div>

      <AnimatePresence>
        {files.map((f, i) => (
          <motion.div
            key={`${f.name}-${i}`}
            initial={{ opacity: 0, x: 20, height: 0 }}
            animate={{ opacity: 1, x: 0, height: 'auto' }}
            exit={{ opacity: 0, x: -20, height: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2"
          >
            {getIcon(f.name)}
            <span className="text-sm flex-1 truncate">{f.name}</span>
            <span className="text-xs text-muted-foreground">({(f.size / 1024).toFixed(0)}KB)</span>
            <button type="button" onClick={e => { e.stopPropagation(); removeFile(i); }}
              className="p-1 rounded-full hover:bg-destructive/10 transition-colors">
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
