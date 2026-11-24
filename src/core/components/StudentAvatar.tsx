// Reusable Print-Safe StudentAvatar Component (Loads compressed photo from studentProfiles -> DataURL, with clean Persian initials fallback)
import React, { useEffect, useState } from 'react';
import { getMediaBlob } from '../data/mediaBlobStore';
import { useSchoolData } from '../data/DataContext';

interface StudentAvatarProps {
  studentId: string;
  studentName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getPersianInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'د';
  if (parts.length === 1) return parts[0].charAt(0);
  return `${parts[0].charAt(0)}‌.${parts[parts.length - 1].charAt(0)}`;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-9 h-9 text-xs rounded-xl',
  md: 'w-12 h-12 text-sm rounded-xl',
  lg: 'w-16 h-16 text-base rounded-2xl',
};

export const StudentAvatar: React.FC<StudentAvatarProps> = ({
  studentId,
  studentName,
  size = 'md',
  className = '',
}) => {
  const { studentProfiles } = useSchoolData();
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  const profile = studentProfiles.find((p) => p.studentId === studentId);
  const photoMediaId = profile?.documents.find(
    (d) => d.docCategory === 'photo' && d.kind === 'image'
  )?.mediaId;

  useEffect(() => {
    let active = true;
    if (!photoMediaId) {
      setPhotoDataUrl(null);
      return;
    }

    getMediaBlob(photoMediaId)
      .then((record) => {
        if (!active || !record?.blob) return;
        const reader = new FileReader();
        reader.onload = () => {
          if (active && typeof reader.result === 'string') {
            setPhotoDataUrl(reader.result);
          }
        };
        reader.readAsDataURL(record.blob);
      })
      .catch(() => {
        if (active) setPhotoDataUrl(null);
      });

    return () => {
      active = false;
    };
  }, [photoMediaId]);

  if (photoDataUrl) {
    return (
      <img
        src={photoDataUrl}
        alt={`تصویر ${studentName}`}
        referrerPolicy="no-referrer"
        className={`object-cover border border-slate-200 dark:border-slate-700 bg-white shrink-0 ${SIZE_CLASSES[size]} ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={`آواتار ${studentName}`}
      className={`inline-flex items-center justify-center font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shrink-0 select-none ${SIZE_CLASSES[size]} ${className}`}
    >
      {getPersianInitials(studentName)}
    </div>
  );
};
