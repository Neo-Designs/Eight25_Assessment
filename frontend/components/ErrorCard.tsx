'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface ErrorCardProps {
  icon: React.ReactNode;
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
}

export default function ErrorCard({
  icon,
  title,
  message,
  actionLabel = 'Return Home',
  actionHref = '/',
}: ErrorCardProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex flex-col items-center justify-center p-6 text-light-text dark:text-dark-text">
      <div className="max-w-md w-full bg-light-surface dark:bg-dark-surface border border-rose-500/20 p-8 rounded-3xl text-center space-y-4 shadow-2xl">
        <div className="flex justify-center">{icon}</div>
        <h1 className="text-xl font-bold text-light-text dark:text-dark-text">{title}</h1>
        <p className="text-secondary text-sm">{message}</p>
        <button
          onClick={() => router.push(actionHref)}
          className="w-full bg-primary hover:bg-primary-hover text-white font-medium py-2 rounded-xl transition text-sm"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
