import { useState, useCallback } from 'preact/hooks';

interface Props {
  latexContent: string;
  markdownContent: string;
}

export function ExportButtons({ latexContent, markdownContent }: Props) {
  const [copiedType, setCopiedType] = useState<'latex' | 'markdown' | null>(null);

  const copyToClipboard = useCallback(async (content: string, type: 'latex' | 'markdown') => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      console.error('复制失败:', err);
      // 降级方案
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    }
  }, []);

  return (
    <div class="export-buttons">
      <button
        class={`export-btn ${copiedType === 'latex' ? 'copied' : ''}`}
        onClick={() => copyToClipboard(latexContent, 'latex')}
      >
        {copiedType === 'latex' ? '✓ 已复制' : '📋 复制为 LaTeX'}
      </button>
      <button
        class={`export-btn ${copiedType === 'markdown' ? 'copied' : ''}`}
        onClick={() => copyToClipboard(markdownContent, 'markdown')}
      >
        {copiedType === 'markdown' ? '✓ 已复制' : '📋 复制为 Markdown'}
      </button>
    </div>
  );
}