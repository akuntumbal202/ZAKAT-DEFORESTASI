import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cx } from '../../lib/format';
import { Icon, type IconName } from './Icon';

interface FieldShell {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
}

function Shell({ id, label, hint, error, className, children }: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className={cx('field', error && 'field--error', className)}>
      {label && (
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="field__error" id={`${id}-err`} role="alert">
          <Icon name="alert" size={14} /> {error}
        </p>
      ) : hint ? (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = FieldShell & InputHTMLAttributes<HTMLInputElement> & { icon?: IconName; prefix?: string; suffix?: ReactNode };

export function Input({ label, hint, error, className, icon, prefix, suffix, id, type, ...rest }: InputProps) {
  const auto = useId();
  const fid = id ?? auto;
  const [show, setShow] = useState(false);
  const isPw = type === 'password';
  return (
    <Shell id={fid} label={label} hint={hint} error={error} className={className}>
      <div className={cx('input', !!icon && 'input--icon', !!prefix && 'input--prefix')}>
        {icon && <Icon name={icon} size={17} className="input__icon" />}
        {prefix && <span className="input__prefix">{prefix}</span>}
        <input
          id={fid}
          type={isPw && show ? 'text' : type}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
          {...rest}
        />
        {isPw && (
          <button type="button" className="input__action" onClick={() => setShow((s) => !s)} aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>
            <Icon name={show ? 'eye-off' : 'eye'} size={17} />
          </button>
        )}
        {suffix}
      </div>
    </Shell>
  );
}

export function Textarea({ label, hint, error, className, id, ...rest }: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Shell id={fid} label={label} hint={hint} error={error} className={className}>
      <div className="input input--area">
        <textarea id={fid} aria-invalid={!!error || undefined} {...rest} />
      </div>
    </Shell>
  );
}

export function Select({ label, hint, error, className, id, children, ...rest }: FieldShell & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Shell id={fid} label={label} hint={hint} error={error} className={className}>
      <div className="input input--select">
        <select id={fid} {...rest}>
          {children}
        </select>
        <Icon name="chevron-down" size={16} className="input__chev" />
      </div>
    </Shell>
  );
}

export function Checkbox({ label, checked, onChange, id }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; id?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <label className="checkbox" htmlFor={fid}>
      <input id={fid} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="checkbox__box" aria-hidden>
        <Icon name="check" size={13} strokeWidth={2.5} />
      </span>
      <span>{label}</span>
    </label>
  );
}
