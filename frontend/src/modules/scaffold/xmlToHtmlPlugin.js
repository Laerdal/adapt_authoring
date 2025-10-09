define([], function() {
  
  // XML to HTML Conversion Plugin with XSLT support
  function xmlToHtmlPlugin(editor) {
    const balloon = editor.plugins.get('ContextualBalloon');

    // XSLT Stylesheet for Paligo DocBook → HTML Conversion
    const xsltStylesheet = `<?xml version="1.0" encoding="UTF-8"?>
  <xsl:stylesheet version="1.0"
      xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
      xmlns:db="http://docbook.org/ns/docbook"
      xmlns:xl="http://www.w3.org/1999/xlink"
      exclude-result-prefixes="db xl">

    <xsl:output method="html" encoding="UTF-8" indent="yes"/>

    <!-- Root: support article or section -->
    <xsl:template match="/">
      <div class="docbook-content">
        <xsl:apply-templates select="db:article | db:section"/>
      </div>
    </xsl:template>

    <!-- Section -->
    <xsl:template match="db:section">
      <section>
        <xsl:apply-templates/>
      </section>
    </xsl:template>

    <!-- Title -->
    <xsl:template match="db:title">
      <h2><xsl:apply-templates/></h2>
    </xsl:template>

    <!-- Paragraphs -->
    <xsl:template match="db:para | db:simpara">
      <p><xsl:apply-templates/></p>
    </xsl:template>

    <!-- Procedure / Steps -->
    <xsl:template match="db:procedure">
      <ol class="procedure">
        <xsl:apply-templates select="db:step"/>
      </ol>
    </xsl:template>

    <xsl:template match="db:step">
      <li class="step"><xsl:apply-templates/></li>
    </xsl:template>

    <!-- Lists -->
    <xsl:template match="db:itemizedlist">
      <ul><xsl:apply-templates/></ul>
    </xsl:template>

    <xsl:template match="db:listitem">
      <li><xsl:apply-templates/></li>
    </xsl:template>

    <!-- Emphasis -->
    <xsl:template match="db:emphasis">
      <xsl:choose>
        <xsl:when test="@role='bold' or @role='strong'">
          <strong><xsl:apply-templates/></strong>
        </xsl:when>
        <xsl:otherwise>
          <em><xsl:apply-templates/></em>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:template>

    <!-- Inline code -->
    <xsl:template match="db:command | db:filename | db:literal | db:keycap">
      <code><xsl:apply-templates/></code>
    </xsl:template>

    <!-- Links -->
    <xsl:template match="db:link">
      <a href="{@xl:href}">
        <xsl:apply-templates/>
      </a>
    </xsl:template>

    <!-- Tables -->
    <xsl:template match="db:table">
      <table><xsl:apply-templates/></table>
    </xsl:template>
    <xsl:template match="db:tgroup"><xsl:apply-templates/></xsl:template>
    <xsl:template match="db:thead"><thead><xsl:apply-templates/></thead></xsl:template>
    <xsl:template match="db:tbody"><tbody><xsl:apply-templates/></tbody></xsl:template>
    <xsl:template match="db:row"><tr><xsl:apply-templates/></tr></xsl:template>
    <xsl:template match="db:entry"><td><xsl:apply-templates/></td></xsl:template>

    <!-- Default -->
    <xsl:template match="*">
      <div data-tag="{local-name()}"><xsl:apply-templates/></div>
    </xsl:template>

  </xsl:stylesheet>`;

    // Check if editor is empty helper function
    function isCKEditorEmpty(editor) {
      const data = editor.getData().replace(/\s/g, '');
      const emptyPatterns = ['', '<p></p>', '<p>&nbsp;</p>', '<p><br></p>', '<div></div>', '<div>&nbsp;</div>', '<div><br></div>'];
      return !data || emptyPatterns.includes(data) || data.replace(/<p>(&nbsp;|<br>|)<\/p>/g, '').length === 0;
    }

    // XML → HTML Transformer (DocBook XSLT first, generic fallback for any XML)
    function transformXmlToHtml(xmlString) {
      function escapeHtml(str) {
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      // Generic serializer: converts any XML node to a readable HTML representation.
      function serializeNode(node) {
        if (!node) return '';
        switch (node.nodeType) {
          case Node.DOCUMENT_NODE:
            return Array.from(node.childNodes).map(serializeNode).join('');
          case Node.ELEMENT_NODE: {
            const tag = node.localName || node.nodeName;
            const attrs = Array.from(node.attributes || []).map(a => `<span class="xml-attr"><strong>${escapeHtml(a.name)}</strong>="${escapeHtml(a.value)}"</span>`).join(' ');
            const children = Array.from(node.childNodes).map(serializeNode).join('');
            // Normalize empty text-only nodes
            const hasVisibleText = children.replace(/\s+/g, '') !== '';
            return `<div class="xml-node" data-tag="${escapeHtml(tag)}">${attrs ? `<div class="xml-attrs">${attrs}</div>` : ''}${hasVisibleText ? `<div class="xml-children">${children}</div>` : ''}</div>`;
          }
          case Node.TEXT_NODE: {
            const txt = node.nodeValue || '';
            if (!txt.trim()) return ''; // skip pure whitespace
            return `<p class="xml-text">${escapeHtml(txt)}</p>`;
          }
          case Node.CDATA_SECTION_NODE:
            return `<pre class="xml-cdata">${escapeHtml(node.nodeValue)}</pre>`;
          case Node.COMMENT_NODE:
            return `<div class="xml-comment">&lt;!-- ${escapeHtml(node.nodeValue)} --&gt;</div>`;
          default:
            return '';
        }
      }

      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString.trim(), 'application/xml');
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) throw new Error('XML parsing error: ' + parseError.textContent);

        // Detect DocBook root by namespace or root element name
        const root = xmlDoc.documentElement;
        const ns = root && root.namespaceURI;
        const localName = root && (root.localName || root.nodeName.toLowerCase());

        const looksLikeDocBook =
          (ns && ns.indexOf('docbook') !== -1) ||
          /^(article|section|chapter|book|bookinfo)$/i.test(localName);

        if (looksLikeDocBook) {
          // Use existing XSLT stylesheet (xsltStylesheet defined above in file)
          try {
            const xsltParser = new DOMParser();
            const xsltDoc = xsltParser.parseFromString(xsltStylesheet, 'application/xml');
            const xsltError = xsltDoc.querySelector('parsererror');
            if (xsltError) throw new Error('XSLT parsing error: ' + xsltError.textContent);

            const xsltProcessor = new XSLTProcessor();
            xsltProcessor.importStylesheet(xsltDoc);

            // Prefer transformToFragment; fallback to transformToDocument -> serialize
            let resultHtml = '';
            try {
              const frag = xsltProcessor.transformToFragment(xmlDoc, document);
              if (frag && frag instanceof Node) {
                const container = document.createElement('div');
                container.appendChild(frag);
                resultHtml = container.innerHTML;
              } else {
                // fallback to transformToDocument if available
                if (typeof xsltProcessor.transformToDocument === 'function') {
                  const doc = xsltProcessor.transformToDocument(xmlDoc);
                  if (doc && doc.documentElement) {
                    resultHtml = new XMLSerializer().serializeToString(doc.documentElement);
                  }
                }
              }
            } catch (xsltErr) {
              // final fallback to generic serializer below
              console.warn('XSLT transform failed, falling back to generic XML serializer', xsltErr);
            }

            if (resultHtml && resultHtml.trim()) {
              return resultHtml.replace(/xmlns(:\w+)?="[^"]*"/g, '').replace(/<\?xml[^>]*\?>/g, '').trim();
            }
            // otherwise continue to generic fallback
          } catch (err) {
            console.warn('DocBook XSLT path failed, falling back to generic XML serializer:', err);
            // fallthrough to generic serializer
          }
        }

        // Generic fallback: produce readable HTML for any XML
        const html = serializeNode(xmlDoc);
        return `<div class="generic-xml">${html}</div>`;
      } catch (error) {
        console.error('XSLT / XML transformation error:', error);
        throw error;
      }
    }

    // CKEditor UI Integration
    const popupView = {
      element: null,
      render() {},
      destroy() {}
    };

    const closePopup = (panelElement, outsideClickHandler) => {
      if (balloon.hasView(popupView)) {
        balloon.remove(popupView);
      }
      if (panelElement.parentNode) panelElement.parentNode.removeChild(panelElement);
      document.removeEventListener('mousedown', outsideClickHandler);
    };

    // Toolbar Button
    editor.ui.componentFactory.add('xmlToHtmlConversion', locale => {
      const undoView = editor.ui.componentFactory.create('undo');
      const ButtonView = undoView.constructor;

      const button = new ButtonView(locale);
      button.set({
        label: 'Paste your XML',
        icon: '<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 115.28 122.88" style="enable-background:new 0 0 115.28 122.88; width: 50px; height: auto;" xml:space="preserve"><style type="text/css">.st0{fill-rule:evenodd;clip-rule:evenodd;}</style><g><path class="st0" d="M25.38,57h64.88V37.34H69.59c-2.17,0-5.19-1.17-6.62-2.6c-1.43-1.43-2.3-4.01-2.3-6.17V7.64l0,0H8.15 c-0.18,0-0.32,0.09-0.41,0.18C7.59,7.92,7.55,8.05,7.55,8.24v106.45c0,0.14,0.09,0.32,0.18,0.41c0.09,0.14,0.28,0.18,0.41,0.18 c22.78,0,58.09,0,81.51,0c0.18,0,0.17-0.09,0.27-0.18c0.14-0.09,0.33-0.28,0.33-0.41v-11.16H25.38c-4.14,0-7.56-3.4-7.56-7.56 V64.55C17.82,60.4,21.22,57,25.38,57L25.38,57z M29.98,68.76h7.76l4.03,7l3.92-7h7.66l-7.07,11.02l7.74,11.73h-7.91l-4.47-7.31 l-4.5,7.31h-7.85l7.85-11.86L29.98,68.76L29.98,68.76z M55.72,68.76H65l3.53,13.85l3.54-13.85h9.23v22.76h-5.75V74.17l-4.44,17.35 H65.9l-4.43-17.35v17.35h-5.75V68.76L55.72,68.76z M85.31,68.76h7.03v17.16h11v5.59H85.31V68.76L85.31,68.76z M97.79,57h9.93 c4.16,0,7.56,3.41,7.56,7.56v31.42c0,4.15-3.41,7.56-7.56,7.56h-9.93v13.55c0,1.61-0.65,3.04-1.7,4.1c-1.06,1.06-2.49,1.7-4.1,1.7 c-29.44,0-56.59,0-86.18,0c-1.61,0-3.04-0.64-4.1-1.7c-1.06-1.06-1.7-2.49-1.7-4.1V5.85c0-1.61,0.65-3.04,1.7-4.1 c1.06-1.06,2.53-1.7,4.1-1.7h58.72C64.66,0,64.8,0,64.94,0c0.64,0,1.29,0.28,1.75,0.69h0.09c0.09,0.05,0.14,0.09,0.23,0.18 l29.99,30.36c0.51,0.51,0.88,1.2,0.88,1.98c0,0.23-0.05,0.41-0.09,0.65V57L97.79,57z M67.52,27.97V8.94l21.43,21.7H70.19 c-0.74,0-1.38-0.32-1.89-0.78C67.84,29.4,67.52,28.71,67.52,27.97L67.52,27.97z"/></g></svg>',
        tooltip: true,
        tooltipPosition: 'n',
        class: 'xml-to-html-button'
      });

      // Button click handler
      button.on('execute', () => {
        const panelElement = document.createElement('div');
        panelElement.classList.add('xml-import-popup-panel');
        panelElement.innerHTML = `
          <div class="XmlImport">
            <span id="closeXmlPopup">×</span>
            <label><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 115.28 122.88" style="enable-background:new 0 0 115.28 122.88; width: 50px; height: auto;" xml:space="preserve"><style type="text/css">.st0{fill-rule:evenodd;clip-rule:evenodd;}</style><g><path class="st0" d="M25.38,57h64.88V37.34H69.59c-2.17,0-5.19-1.17-6.62-2.6c-1.43-1.43-2.3-4.01-2.3-6.17V7.64l0,0H8.15 c-0.18,0-0.32,0.09-0.41,0.18C7.59,7.92,7.55,8.05,7.55,8.24v106.45c0,0.14,0.09,0.32,0.18,0.41c0.09,0.14,0.28,0.18,0.41,0.18 c22.78,0,58.09,0,81.51,0c0.18,0,0.17-0.09,0.27-0.18c0.14-0.09,0.33-0.28,0.33-0.41v-11.16H25.38c-4.14,0-7.56-3.4-7.56-7.56 V64.55C17.82,60.4,21.22,57,25.38,57L25.38,57z M29.98,68.76h7.76l4.03,7l3.92-7h7.66l-7.07,11.02l7.74,11.73h-7.91l-4.47-7.31 l-4.5,7.31h-7.85l7.85-11.86L29.98,68.76L29.98,68.76z M55.72,68.76H65l3.53,13.85l3.54-13.85h9.23v22.76h-5.75V74.17l-4.44,17.35 H65.9l-4.43-17.35v17.35h-5.75V68.76L55.72,68.76z M85.31,68.76h7.03v17.16h11v5.59H85.31V68.76L85.31,68.76z M97.79,57h9.93 c4.16,0,7.56,3.41,7.56,7.56v31.42c0,4.15-3.41,7.56-7.56,7.56h-9.93v13.55c0,1.61-0.65,3.04-1.7,4.1c-1.06,1.06-2.49,1.7-4.1,1.7 c-29.44,0-56.59,0-86.18,0c-1.61,0-3.04-0.64-4.1-1.7c-1.06-1.06-1.7-2.49-1.7-4.1V5.85c0-1.61,0.65-3.04,1.7-4.1 c1.06-1.06,2.53-1.7,4.1-1.7h58.72C64.66,0,64.8,0,64.94,0c0.64,0,1.29,0.28,1.75,0.69h0.09c0.09,0.05,0.14,0.09,0.23,0.18 l29.99,30.36c0.51,0.51,0.88,1.2,0.88,1.98c0,0.23-0.05,0.41-0.09,0.65V57L97.79,57z M67.52,27.97V8.94l21.43,21.7H70.19 c-0.74,0-1.38-0.32-1.89-0.78C67.84,29.4,67.52,28.71,67.52,27.97L67.52,27.97z"/></g></svg> Paste from XML</label>
            <textarea id="xmlInputArea" placeholder="Paste your XML here..."></textarea>
            <div class="xmlButtons">
              <button class="btnXmlImport buttonSubmit" id="xmlSubmitBtn">Submit</button>
              <button class="btnXmlImport buttonCancel" id="xmlCancelBtn">Cancel</button>
            </div>
          </div>`;

        document.body.appendChild(panelElement);
        popupView.element = panelElement;

        // Button handlers
        panelElement.querySelector('#closeXmlPopup').onclick = () =>
          closePopup(panelElement, outsideClickHandler);
        panelElement.querySelector('#xmlCancelBtn').onclick = () =>
          closePopup(panelElement, outsideClickHandler);
        panelElement.querySelector('#xmlSubmitBtn').onclick = () => {
          const xmlContent = panelElement.querySelector('#xmlInputArea').value.trim();

          // Clear any previous inline error
          const prevError = panelElement.querySelector('.xml-error-msg');
          if (prevError) prevError.remove();

          if (!xmlContent) {
            // Show inline error under the textarea instead of alert
            const errDiv = document.createElement('div');
            errDiv.className = 'xml-error-msg';
            errDiv.style.cssText = 'color:#b00020;margin-top:8px;font-size:13px;';
            errDiv.textContent = 'Please paste valid XML content.';
            panelElement.querySelector('#xmlInputArea').insertAdjacentElement('afterend', errDiv);
            panelElement.querySelector('#xmlInputArea').focus();
            return;
          }

          try {
            const htmlContent = transformXmlToHtml(xmlContent);
            const existingData = editor.getData ? (editor.getData() || '') : '';
            const empty = isCKEditorEmpty(editor) || !existingData || /^\s*$/.test(existingData);

            if (empty) {
              editor.setData(htmlContent);
            } else {
              try {
                const viewFragment = editor.data.processor.toView(htmlContent);
                const modelFragment = editor.data.toModel(viewFragment);
                editor.model.change(writer => {
                  const selection = editor.model.document.selection;
                  editor.model.insertContent(modelFragment, selection.getLastPosition());
                });
              } catch (insertErr) {
                const sep = existingData.trim().endsWith('</') ? '' : '<div></div>';
                editor.setData(existingData + sep + htmlContent);
              }
            }

            closePopup(panelElement, outsideClickHandler);
          } catch (error) {
            // Extract short parser message without line/column or rendering junk
            function extractShortXmlError(err) {
              let msg = err && err.message ? err.message : String(err);

              // Remove common verbose prefixes
              msg = msg.replace(/^XML parsing error:\s*/i, '');
              msg = msg.replace(/^XSLT parsing error:\s*/i, '');
              msg = msg.replace(/^This page contains the following errors:\s*/i, '');

              // Remove "error on line X at column Y:" fragments
              msg = msg.replace(/error on line\s*\d+\s*at column\s*\d+:\s*/i, '');
              msg = msg.replace(/:\s*error on line\s*\d+/i, '');

              // Strip "Below is a rendering" and anything after it
              msg = msg.split(/Below is a rendering/i)[0].trim();

              // Take first non-empty line
              const firstLine = (msg.split(/\r?\n/).find(Boolean) || '').trim();

              // Try to capture common meaningful parser messages
              const pattern = /(Opening and ending tag mismatch:[^.;\n]+)|(not well-formed[^.;\n]+)|(Entity|Reference|Expected|mismatch)[^.;\n]*/i;
              const match = firstLine.match(pattern);
              if (match && match[0]) return match[0].trim();

              // Fallback: remove any leftover location parentheses and trim
              const cleaned = firstLine.replace(/\(.*line.*\)/i, '').replace(/\(.*\)/, '').trim();
              return cleaned.length ? (cleaned.length > 200 ? cleaned.slice(0,197) + '...' : cleaned) : 'Invalid or malformed XML';
            }

            const shortMsg = extractShortXmlError(error);

            const errDiv = document.createElement('div');
            errDiv.className = 'xml-error-msg';
            errDiv.style.cssText = 'color:#b00020;margin-top:8px;font-size:13px;white-space:pre-wrap;';
            errDiv.textContent = 'Error processing XML: ' + shortMsg;

            // insert or replace after the textarea
            const area = panelElement.querySelector('#xmlInputArea');
            const existing = panelElement.querySelector('.xml-error-msg');
            if (existing) existing.replaceWith(errDiv);
            else area.insertAdjacentElement('afterend', errDiv);

            // keep popup open and focus textarea for correction
            area.focus();
          }
        };

        // Outside click handler
        const outsideClickHandler = event => {
          const balloonEl = balloon.view.element;
          if (balloonEl && !balloonEl.contains(event.target)) {
            closePopup(panelElement, outsideClickHandler);
          }
        };

        if (!balloon.hasView(popupView)) {
          balloon.add({
            view: popupView,
            position: {
              target: () => {
                const editorElement = editor.ui.view.element;
                const xmlButton = editorElement.querySelector('.xml-to-html-button');
                return xmlButton || editor.ui.view.editable.element;
              },
              positions: [
                (targetRect, balloonRect) => ({
                  top: targetRect.bottom + 25,
                  left: targetRect.left,
                  name: 'below'
                })
              ]
            }
          });
          document.addEventListener('mousedown', outsideClickHandler);
        } else {
          closePopup(panelElement, outsideClickHandler);
        }
      });

      return button;
    });
  }

  // Return the plugin function for use in other modules
  return xmlToHtmlPlugin;
});