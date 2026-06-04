import { useEffect, useRef } from 'react';
import Quill from 'quill';

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start drafting the agreement content...',
  minHeight = 260,
  className = '',
}) {
  const toolbarIdRef = useRef(`contract-editor-toolbar-${Math.random().toString(36).slice(2, 10)}`);
  const editorRef = useRef(null);
  const quillRef = useRef(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!editorRef.current || quillRef.current) {
      return undefined;
    }

    const quill = new Quill(editorRef.current, {
      theme: 'snow',
      placeholder,
      modules: {
        toolbar: {
          container: `#${toolbarIdRef.current}`,
        },
        history: {
          delay: 300,
          maxStack: 50,
          userOnly: true,
        },
      },
    });

    quillRef.current = quill;

    if (value) {
      quill.clipboard.dangerouslyPasteHTML(value);
    }

    const handleTextChange = () => {
      const html = quill.root.innerHTML === '<p><br></p>' ? '' : quill.root.innerHTML;

      if (onChangeRef.current) {
        onChangeRef.current(html);
      }
    };

    quill.on('text-change', handleTextChange);

    return () => {
      quill.off('text-change', handleTextChange);
      quillRef.current = null;

      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
    };
  }, [placeholder, value]);

  useEffect(() => {
    const quill = quillRef.current;

    if (!quill) {
      return;
    }

    const currentHtml = quill.root.innerHTML === '<p><br></p>' ? '' : quill.root.innerHTML;
    const nextHtml = value || '';

    if (currentHtml === nextHtml) {
      return;
    }

    const selection = quill.getSelection();

    if (!nextHtml) {
      quill.setText('');
    } else {
      quill.clipboard.dangerouslyPasteHTML(nextHtml);
    }

    if (selection) {
      try {
        quill.setSelection(Math.max(0, Math.min(selection.index, quill.getLength() - 1)), selection.length);
      } catch {
        // Ignore selection restoration issues after programmatic updates.
      }
    }
  }, [value]);

  return (
    <div className={`contract-rich-editor ${className}`.trim()}>
      <div id={toolbarIdRef.current} className="contract-rich-editor-toolbar">
        <span className="ql-formats">
          <select className="ql-header" defaultValue="">
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
            <option value="">Body</option>
          </select>
        </span>

        <span className="ql-formats">
          <button type="button" className="ql-bold" aria-label="Bold" />
          <button type="button" className="ql-italic" aria-label="Italic" />
          <button type="button" className="ql-underline" aria-label="Underline" />
          <button type="button" className="ql-strike" aria-label="Strikethrough" />
        </span>

        <span className="ql-formats">
          <button type="button" className="ql-blockquote" aria-label="Blockquote" />
          <button type="button" className="ql-list" value="ordered" aria-label="Numbered list" />
          <button type="button" className="ql-list" value="bullet" aria-label="Bulleted list" />
        </span>

        <span className="ql-formats">
          <button type="button" className="ql-link" aria-label="Insert link" />
          <select className="ql-align" defaultValue="">
            <option value="">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
            <option value="justify">Justify</option>
          </select>
        </span>

        <span className="ql-formats">
          <button type="button" className="ql-clean" aria-label="Clear formatting" />
        </span>
      </div>

      <div className="contract-rich-editor-surface" ref={editorRef} style={{ minHeight }} />
    </div>
  );
}
