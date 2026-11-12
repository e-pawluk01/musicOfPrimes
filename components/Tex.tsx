import katex from 'katex';

/** Shows a piece of maths, typeset. */
export function Tex({ tex, className }: { tex: string; className?: string }) {
  const html = katex.renderToString(tex, { throwOnError: false, output: 'html' });
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
