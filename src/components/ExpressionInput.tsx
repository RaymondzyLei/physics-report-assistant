import { useCallback, useRef } from 'preact/hooks';

interface Props {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}

export function ExpressionInput({ value, onChange, error }: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback((e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    onChange(target.value);
  }, [onChange]);

  return (
    <div class="expression-input">
      <label htmlFor="expression">输入物理量表达式：</label>
      <textarea
        ref={inputRef}
        id="expression"
        value={value}
        onInput={handleChange}
        placeholder="例如: rho = 4 * m / (pi * d^2 * L)"
        rows={2}
        class={error ? 'error' : ''}
      />
      <div class="input-hint">
        支持运算符：+, -, *, /, ^（幂）<br/>
        支持函数：sqrt(), sin(), cos(), tan(), ln(), log(), exp()<br/>
        常量：pi, e
      </div>
      {error && <div class="error-message">{error}</div>}
    </div>
  );
}