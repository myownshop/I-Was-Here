import React, { useState } from 'react';

interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  hint?: string;
  isMono?: boolean;
}

export function FloatingInput({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  isMono = false,
  ...props
}: FloatingInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const isFloating = isFocused || (value && value.length > 0);

  return (
    <div className="relative w-full mb-3">
      <div
        className={`relative w-full rounded-xl border transition-all duration-200 bg-[#0e1219] ${
          error
            ? 'border-rose-500/80 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
            : isFocused
            ? 'border-[#00FF66] shadow-[0_0_15px_rgba(0,255,102,0.2)]'
            : 'border-[#222a38] hover:border-slate-700'
        }`}
      >
        <input
          id={id}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`w-full pt-6 pb-2.5 px-4 text-sm text-[#f0f3f6] bg-transparent outline-none transition-colors ${
            isMono ? 'font-mono uppercase tracking-wider font-semibold' : 'font-normal'
          }`}
          placeholder=""
          {...props}
        />
        <label
          htmlFor={id}
          className={`absolute left-4 transition-all duration-200 pointer-events-none ${
            isFloating
              ? 'top-2 text-[10px] font-bold tracking-wider uppercase ' +
                (error ? 'text-rose-400' : isFocused ? 'text-[#00FF66]' : 'text-slate-400')
              : 'top-4 text-xs text-slate-400'
          }`}
        >
          {label}
        </label>
      </div>

      {error ? (
        <p id={`${id}-error`} className="text-[11px] text-rose-400 mt-1 pl-1 font-medium">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[11px] text-slate-400 mt-1 pl-1">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
