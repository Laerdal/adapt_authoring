define([], function() {
  
  // XML to HTML Conversion Plugin with XSLT support
  function xmlToHtmlPlugin(editor) {
    const balloon = editor.plugins.get('ContextualBalloon');

    // Comprehensive XSLT Stylesheet for DocBook → HTML Conversion
    const xsltStylesheet = `<?xml version="1.0" encoding="UTF-8"?>
  <xsl:stylesheet version="1.0"
      xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
      xmlns:db="http://docbook.org/ns/docbook"
      xmlns:xl="http://www.w3.org/1999/xlink"
      exclude-result-prefixes="db xl">

    <xsl:output method="html" encoding="UTF-8" indent="yes"/>

    <!-- ========== ROOT & DOCUMENT STRUCTURE ========== -->
    <xsl:template match="/">
      <div class="docbook-content">
        <xsl:apply-templates/>
      </div>
    </xsl:template>

    <!-- Document Root Elements -->
    <xsl:template match="db:article | db:book | db:chapter | article | book | chapter">
      <article class="docbook-{local-name()}">
        <xsl:apply-templates/>
      </article>
    </xsl:template>

    <!-- Sections -->
    <xsl:template match="db:section | db:sect1 | db:sect2 | db:sect3 | db:sect4 | db:sect5 | section | sect1 | sect2 | sect3 | sect4 | sect5">
      <section class="docbook-section">
        <xsl:apply-templates/>
      </section>
    </xsl:template>

    <!-- ========== TITLES & HEADINGS ========== -->
    <xsl:template match="db:title | title">
      <xsl:variable name="level">
        <xsl:choose>
          <xsl:when test="parent::db:article or parent::db:book or parent::article or parent::book">h1</xsl:when>
          <xsl:when test="parent::db:chapter or parent::db:sect1 or parent::chapter or parent::sect1">h2</xsl:when>
          <xsl:when test="parent::db:sect2 or parent::sect2">h3</xsl:when>
          <xsl:when test="parent::db:sect3 or parent::sect3">h4</xsl:when>
          <xsl:when test="parent::db:sect4 or parent::sect4">h5</xsl:when>
          <xsl:when test="parent::db:sect5 or parent::sect5">h6</xsl:when>
          <xsl:when test="parent::db:section or parent::section">h2</xsl:when>
          <xsl:otherwise>h2</xsl:otherwise>
        </xsl:choose>
      </xsl:variable>
      <xsl:element name="{$level}">
        <xsl:apply-templates/>
      </xsl:element>
    </xsl:template>

    <xsl:template match="db:subtitle | subtitle">
      <p class="subtitle"><xsl:apply-templates/></p>
    </xsl:template>

    <xsl:template match="db:titleabbrev | titleabbrev">
      <span class="title-abbrev"><xsl:apply-templates/></span>
    </xsl:template>

    <!-- ========== BLOCK ELEMENTS ========== -->
    <!-- Paragraphs -->
    <xsl:template match="db:para | db:simpara | para | simpara">
      <p><xsl:apply-templates/></p>
    </xsl:template>

    <!-- Blockquote -->
    <xsl:template match="db:blockquote | blockquote">
      <blockquote>
        <xsl:apply-templates/>
      </blockquote>
    </xsl:template>

    <!-- Note, Warning, Caution, Important, Tip -->
    <xsl:template match="db:note | db:warning | db:caution | db:important | db:tip | note | warning | caution | important | tip">
      <div class="admonition admonition-{local-name()}">
        <xsl:if test="db:title or title">
          <p class="admonition-title"><xsl:value-of select="db:title | title"/></p>
        </xsl:if>
        <xsl:apply-templates select="*[not(self::db:title) and not(self::title)]"/>
      </div>
    </xsl:template>

    <!-- Example -->
    <xsl:template match="db:example | db:informalexample | example | informalexample">
      <div class="example">
        <xsl:apply-templates/>
      </div>
    </xsl:template>

    <!-- Figure -->
    <xsl:template match="db:figure | db:informalfigure | figure | informalfigure">
      <figure>
        <xsl:apply-templates/>
      </figure>
    </xsl:template>

    <!-- ========== LISTS ========== -->
    <!-- Itemized List (Unordered) -->
    <xsl:template match="db:itemizedlist | itemizedlist">
      <ul>
        <xsl:if test="@spacing='compact'">
          <xsl:attribute name="class">compact</xsl:attribute>
        </xsl:if>
        <xsl:apply-templates select="db:listitem | listitem"/>
      </ul>
    </xsl:template>

    <!-- Ordered List -->
    <xsl:template match="db:orderedlist | orderedlist">
      <ol>
        <xsl:if test="@numeration">
          <xsl:attribute name="type">
            <xsl:choose>
              <xsl:when test="@numeration='arabic'">1</xsl:when>
              <xsl:when test="@numeration='loweralpha'">a</xsl:when>
              <xsl:when test="@numeration='upperalpha'">A</xsl:when>
              <xsl:when test="@numeration='lowerroman'">i</xsl:when>
              <xsl:when test="@numeration='upperroman'">I</xsl:when>
            </xsl:choose>
          </xsl:attribute>
        </xsl:if>
        <xsl:apply-templates select="db:listitem | listitem"/>
      </ol>
    </xsl:template>

    <!-- Variable List (Definition List) -->
    <xsl:template match="db:variablelist | variablelist">
      <dl>
        <xsl:apply-templates/>
      </dl>
    </xsl:template>

    <xsl:template match="db:varlistentry | varlistentry">
      <xsl:apply-templates/>
    </xsl:template>

    <xsl:template match="db:term | term">
      <dt><xsl:apply-templates/></dt>
    </xsl:template>

    <xsl:template match="db:listitem | listitem">
      <li><xsl:apply-templates/></li>
    </xsl:template>

    <!-- Simple List -->
    <xsl:template match="db:simplelist | simplelist">
      <ul class="simple-list">
        <xsl:apply-templates/>
      </ul>
    </xsl:template>

    <xsl:template match="db:member | member">
      <li><xsl:apply-templates/></li>
    </xsl:template>

    <!-- ========== PROCEDURES & STEPS ========== -->
    <xsl:template match="db:procedure | procedure">
      <ol class="procedure">
        <xsl:apply-templates/>
      </ol>
    </xsl:template>

    <xsl:template match="db:step | step">
      <li class="step"><xsl:apply-templates/></li>
    </xsl:template>

    <xsl:template match="db:substeps | substeps">
      <ol class="substeps">
        <xsl:apply-templates/>
      </ol>
    </xsl:template>

    <!-- ========== INLINE ELEMENTS ========== -->
    <!-- Emphasis and formatting -->
    <xsl:template match="db:emphasis | emphasis">
      <xsl:choose>
        <xsl:when test="@role='bold' or @role='strong'">
          <strong><xsl:apply-templates/></strong>
        </xsl:when>
        <xsl:otherwise>
          <em><xsl:apply-templates/></em>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:template>

    <xsl:template match="db:phrase | phrase">
      <span>
        <xsl:if test="@role">
          <xsl:attribute name="class"><xsl:value-of select="@role"/></xsl:attribute>
        </xsl:if>
        <xsl:apply-templates/>
      </span>
    </xsl:template>

    <xsl:template match="db:quote | quote">
      <q><xsl:apply-templates/></q>
    </xsl:template>

    <xsl:template match="db:subscript | subscript">
      <sub><xsl:apply-templates/></sub>
    </xsl:template>

    <xsl:template match="db:superscript | superscript">
      <sup><xsl:apply-templates/></sup>
    </xsl:template>

    <!-- Technical and Computer Elements -->
    <xsl:template match="db:command | db:filename | db:literal | db:keycap | db:computeroutput | db:userinput | db:option | db:parameter | db:varname | db:constant | db:function | db:code">
      <code><xsl:apply-templates/></code>
    </xsl:template>

    <xsl:template match="db:application | db:package">
      <span class="application"><xsl:apply-templates/></span>
    </xsl:template>

    <xsl:template match="db:guibutton | db:guimenu | db:guimenuitem | db:guilabel">
      <strong class="gui-element"><xsl:apply-templates/></strong>
    </xsl:template>

    <!-- Keyboard combinations -->
    <xsl:template match="db:keycombo">
      <xsl:variable name="sep">
        <xsl:choose>
          <xsl:when test="@separator">
            <xsl:value-of select="@separator"/>
          </xsl:when>
          <xsl:otherwise>+</xsl:otherwise>
        </xsl:choose>
      </xsl:variable>
      <kbd>
        <xsl:for-each select="*">
          <xsl:apply-templates select="."/>
          <xsl:if test="position() != last()">
            <xsl:value-of select="$sep"/>
          </xsl:if>
        </xsl:for-each>
      </kbd>
    </xsl:template>

    <!-- ========== LINKS & CROSS-REFERENCES ========== -->
    <xsl:template match="db:link | link">
      <a>
        <xsl:choose>
          <xsl:when test="@xl:href">
            <xsl:attribute name="href"><xsl:value-of select="@xl:href"/></xsl:attribute>
          </xsl:when>
          <xsl:when test="@xlink:href">
            <xsl:attribute name="href"><xsl:value-of select="@xlink:href"/></xsl:attribute>
          </xsl:when>
          <xsl:when test="@linkend">
            <xsl:attribute name="href">#<xsl:value-of select="@linkend"/></xsl:attribute>
          </xsl:when>
        </xsl:choose>
        <xsl:apply-templates/>
      </a>
    </xsl:template>

    <xsl:template match="db:ulink | ulink">
      <a href="{@url}">
        <xsl:choose>
          <xsl:when test="text()">
            <xsl:apply-templates/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="@url"/>
          </xsl:otherwise>
        </xsl:choose>
      </a>
    </xsl:template>

    <xsl:template match="db:xref | xref">
      <a href="#{@linkend}">
        <xsl:variable name="endtermId" select="@endterm"/>
        <xsl:variable name="endtermNode" select="//*[@xml:id=$endtermId or @id=$endtermId][1]"/>
        <xsl:choose>
          <xsl:when test="$endtermNode">
            <xsl:apply-templates select="$endtermNode"/>
          </xsl:when>
          <xsl:when test="@endterm">
            <xsl:value-of select="@endterm"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>[Link]</xsl:text>
          </xsl:otherwise>
        </xsl:choose>
      </a>
    </xsl:template>

    <xsl:template match="db:anchor | anchor">
      <a id="{@xml:id}"></a>
    </xsl:template>

    <!-- ========== CODE & PROGRAM LISTINGS ========== -->
    <xsl:template match="db:programlisting | db:screen | db:literallayout">
      <pre>
        <xsl:if test="@language">
          <xsl:attribute name="class">language-<xsl:value-of select="@language"/></xsl:attribute>
        </xsl:if>
        <code><xsl:apply-templates/></code>
      </pre>
    </xsl:template>

    <xsl:template match="db:synopsis">
      <pre class="synopsis"><code><xsl:apply-templates/></code></pre>
    </xsl:template>

    <!-- ========== MEDIA OBJECTS ========== -->
    <xsl:template match="db:mediaobject | db:inlinemediaobject">
      <xsl:apply-templates select="db:imageobject | db:videoobject | db:audioobject"/>
      <xsl:apply-templates select="db:caption"/>
    </xsl:template>

    <xsl:template match="db:imageobject">
      <xsl:apply-templates select="db:imagedata"/>
    </xsl:template>

    <xsl:template match="db:imagedata">
      <img>
        <xsl:if test="@fileref">
          <xsl:attribute name="src"><xsl:value-of select="@fileref"/></xsl:attribute>
        </xsl:if>
        <xsl:if test="@width">
          <xsl:attribute name="width"><xsl:value-of select="@width"/></xsl:attribute>
        </xsl:if>
        <xsl:if test="@depth">
          <xsl:attribute name="height"><xsl:value-of select="@depth"/></xsl:attribute>
        </xsl:if>
        <xsl:if test="@align">
          <xsl:attribute name="align"><xsl:value-of select="@align"/></xsl:attribute>
        </xsl:if>
        <xsl:attribute name="alt">
          <xsl:choose>
            <xsl:when test="../db:textobject/db:phrase">
              <xsl:value-of select="../db:textobject/db:phrase"/>
            </xsl:when>
            <xsl:otherwise>Image</xsl:otherwise>
          </xsl:choose>
        </xsl:attribute>
      </img>
    </xsl:template>

    <xsl:template match="db:caption">
      <figcaption><xsl:apply-templates/></figcaption>
    </xsl:template>

    <xsl:template match="db:videoobject">
      <video controls="controls">
        <xsl:if test="db:videodata/@fileref">
          <xsl:attribute name="src"><xsl:value-of select="db:videodata/@fileref"/></xsl:attribute>
        </xsl:if>
        <xsl:if test="db:videodata/@width">
          <xsl:attribute name="width"><xsl:value-of select="db:videodata/@width"/></xsl:attribute>
        </xsl:if>
        <xsl:if test="db:videodata/@depth">
          <xsl:attribute name="height"><xsl:value-of select="db:videodata/@depth"/></xsl:attribute>
        </xsl:if>
      </video>
    </xsl:template>

    <xsl:template match="db:audioobject">
      <audio controls="controls">
        <xsl:if test="db:audiodata/@fileref">
          <xsl:attribute name="src"><xsl:value-of select="db:audiodata/@fileref"/></xsl:attribute>
        </xsl:if>
      </audio>
    </xsl:template>

    <!-- ========== TABLES ========== -->
    <xsl:template match="db:table | db:informaltable | table | informaltable">
      <table>
        <xsl:if test="@frame">
          <xsl:attribute name="class">frame-<xsl:value-of select="@frame"/></xsl:attribute>
        </xsl:if>
        <xsl:apply-templates select="db:title | title"/>
        <xsl:apply-templates select="db:tgroup | tgroup | db:thead | thead | db:tbody | tbody | db:tfoot | tfoot | db:tr | tr"/>
      </table>
    </xsl:template>
    
    <xsl:template match="db:table/db:title | table/title">
      <caption><xsl:apply-templates/></caption>
    </xsl:template>
    
    <xsl:template match="db:tgroup | tgroup">
      <xsl:apply-templates select="db:colspec | colspec"/>
      <xsl:apply-templates select="db:thead | thead"/>
      <xsl:apply-templates select="db:tbody | tbody"/>
      <xsl:apply-templates select="db:tfoot | tfoot"/>
    </xsl:template>
    
    <xsl:template match="db:colspec | colspec">
      <col>
        <xsl:if test="@colwidth">
          <xsl:attribute name="width"><xsl:value-of select="@colwidth"/></xsl:attribute>
        </xsl:if>
        <xsl:if test="@align">
          <xsl:attribute name="align"><xsl:value-of select="@align"/></xsl:attribute>
        </xsl:if>
      </col>
    </xsl:template>
    
    <xsl:template match="db:thead | thead">
      <thead><xsl:apply-templates select="db:row | row"/></thead>
    </xsl:template>
    
    <xsl:template match="db:tbody | tbody">
      <tbody><xsl:apply-templates select="db:row | row"/></tbody>
    </xsl:template>
    
    <xsl:template match="db:tfoot | tfoot">
      <tfoot><xsl:apply-templates select="db:row | row"/></tfoot>
    </xsl:template>
    
    <xsl:template match="db:row | row">
      <tr>
        <xsl:if test="@role">
          <xsl:attribute name="class"><xsl:value-of select="@role"/></xsl:attribute>
        </xsl:if>
        <xsl:apply-templates select="db:entry | entry"/>
      </tr>
    </xsl:template>
    
    <xsl:template match="db:entry | entry">
      <xsl:variable name="element-name">
        <xsl:choose>
          <xsl:when test="ancestor::db:thead or ancestor::thead">th</xsl:when>
          <xsl:otherwise>td</xsl:otherwise>
        </xsl:choose>
      </xsl:variable>
      
      <xsl:element name="{$element-name}">
        <!-- Handle namest/nameend for colspan -->
        <xsl:if test="@namest and @nameend">
          <xsl:variable name="start-col" select="@namest"/>
          <xsl:variable name="end-col" select="@nameend"/>
          <xsl:variable name="tgroup" select="ancestor::db:tgroup | ancestor::tgroup"/>
          <xsl:variable name="colspecs" select="$tgroup/db:colspec | $tgroup/colspec"/>
          
          <xsl:variable name="start-pos">
            <xsl:for-each select="$colspecs">
              <xsl:if test="@colname = $start-col">
                <xsl:value-of select="position()"/>
              </xsl:if>
            </xsl:for-each>
          </xsl:variable>
          <xsl:variable name="end-pos">
            <xsl:for-each select="$colspecs">
              <xsl:if test="@colname = $end-col">
                <xsl:value-of select="position()"/>
              </xsl:if>
            </xsl:for-each>
          </xsl:variable>
          
          <xsl:if test="$start-pos != '' and $end-pos != ''">
            <xsl:attribute name="colspan">
              <xsl:value-of select="number($end-pos) - number($start-pos) + 1"/>
            </xsl:attribute>
          </xsl:if>
        </xsl:if>
        
        <xsl:if test="@morerows">
          <xsl:attribute name="rowspan"><xsl:value-of select="@morerows + 1"/></xsl:attribute>
        </xsl:if>
        <xsl:if test="@align">
          <xsl:attribute name="align"><xsl:value-of select="@align"/></xsl:attribute>
        </xsl:if>
        <xsl:if test="@valign">
          <xsl:attribute name="valign"><xsl:value-of select="@valign"/></xsl:attribute>
        </xsl:if>
        <xsl:apply-templates/>
      </xsl:element>
    </xsl:template>

    <!-- HTML Tables (CALS tables) -->
    <xsl:template match="db:tr | tr">
      <tr><xsl:apply-templates/></tr>
    </xsl:template>

    <xsl:template match="db:td | td">
      <td>
        <xsl:copy-of select="@*"/>
        <xsl:apply-templates/>
      </td>
    </xsl:template>

    <xsl:template match="db:th | th">
      <th>
        <xsl:copy-of select="@*"/>
        <xsl:apply-templates/>
      </th>
    </xsl:template>

    <!-- ========== METADATA & INFO ========== -->
    <xsl:template match="db:info | db:articleinfo | db:bookinfo">
      <div class="docbook-info">
        <xsl:apply-templates/>
      </div>
    </xsl:template>

    <xsl:template match="db:author | db:editor">
      <div class="author">
        <xsl:apply-templates/>
      </div>
    </xsl:template>

    <xsl:template match="db:firstname">
      <span class="firstname"><xsl:apply-templates/></span>
    </xsl:template>

    <xsl:template match="db:surname">
      <span class="surname"><xsl:apply-templates/></span>
    </xsl:template>

    <xsl:template match="db:email | email">
      <a href="mailto:{.}"><xsl:apply-templates/></a>
    </xsl:template>

    <xsl:template match="db:date | db:pubdate">
      <time><xsl:apply-templates/></time>
    </xsl:template>

    <xsl:template match="db:abstract">
      <div class="abstract">
        <xsl:apply-templates/>
      </div>
    </xsl:template>

    <xsl:template match="db:copyright">
      <p class="copyright">
        <xsl:text>© </xsl:text>
        <xsl:value-of select="db:year"/>
        <xsl:text> </xsl:text>
        <xsl:value-of select="db:holder"/>
      </p>
    </xsl:template>

    <!-- ========== SPECIAL ELEMENTS ========== -->
    <xsl:template match="db:sidebar">
      <aside class="sidebar">
        <xsl:apply-templates/>
      </aside>
    </xsl:template>

    <xsl:template match="db:footnote | footnote">
      <sup class="footnote">
        <xsl:text>[</xsl:text>
        <xsl:number level="any" count="db:footnote | footnote"/>
        <xsl:text>]</xsl:text>
      </sup>
    </xsl:template>

    <xsl:template match="db:glossary">
      <div class="glossary">
        <xsl:apply-templates/>
      </div>
    </xsl:template>

    <xsl:template match="db:glossentry">
      <div class="glossentry">
        <xsl:apply-templates/>
      </div>
    </xsl:template>

    <xsl:template match="db:glossterm">
      <dt class="glossterm"><xsl:apply-templates/></dt>
    </xsl:template>

    <xsl:template match="db:glossdef">
      <dd class="glossdef"><xsl:apply-templates/></dd>
    </xsl:template>

    <!-- Non-namespaced glossary elements for Paligo compatibility -->
    <xsl:template match="glossary">
      <div class="glossary">
        <xsl:apply-templates/>
      </div>
    </xsl:template>

    <xsl:template match="glossentry">
      <div class="glossentry">
        <xsl:apply-templates/>
      </div>
    </xsl:template>

    <xsl:template match="glossterm">
      <dt class="glossterm"><xsl:apply-templates/></dt>
    </xsl:template>

    <xsl:template match="glossdef">
      <dd class="glossdef"><xsl:apply-templates/></dd>
    </xsl:template>
    <xsl:template match="db:index | db:indexterm">
      <!-- Index elements typically not rendered in HTML -->
    </xsl:template>

    <xsl:template match="db:revhistory">
      <div class="revhistory">
        <h3>Revision History</h3>
        <xsl:apply-templates/>
      </div>
    </xsl:template>

    <xsl:template match="db:revision">
      <div class="revision">
        <xsl:apply-templates/>
      </div>
    </xsl:template>

    <xsl:template match="db:revnumber">
      <span class="revnumber">Version <xsl:apply-templates/></span>
    </xsl:template>

    <xsl:template match="db:revremark">
      <p class="revremark"><xsl:apply-templates/></p>
    </xsl:template>

    <!-- Line breaks -->
    <xsl:template match="db:br">
      <br/>
    </xsl:template>

    <!-- Horizontal rule -->
    <xsl:template match="db:hr">
      <hr/>
    </xsl:template>

    <!-- ========== DEFAULT FALLBACK ========== -->
    <xsl:template match="*">
      <div data-tag="{local-name()}">
        <xsl:apply-templates/>
      </div>
    </xsl:template>

    <!-- Text nodes -->
    <xsl:template match="text()">
      <xsl:value-of select="."/>
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

      // Generic serializer: converts any XML node to a readable HTML representation with table support.
      // isDocBook flag prevents data-centric detection from interfering with DocBook table handling
      function serializeNode(node, isDocBook = false) {
        if (!node) return '';
        switch (node.nodeType) {
          case Node.DOCUMENT_NODE:
            return Array.from(node.childNodes).map(child => serializeNode(child, isDocBook)).join('');
          case Node.ELEMENT_NODE: {
            const tag = getTagName(node);
            
            // Priority 1: Check for data-centric structures (only for non-DocBook XML)
            // This prevents interference with Paligo-generated DocBook table structures
            if (!isDocBook) {
              const dataCentricInfo = detectDataCentricStructure(node);
              if (dataCentricInfo.isDataCentric) {
                return buildDataCentricTable(node, dataCentricInfo, isDocBook);
              }
            }
            
            // Priority 2: Enhanced table structure detection and conversion
            if (isTableElement(tag)) {
              return convertToHtmlTable(node, isDocBook);
            }
            
            const attrs = Array.from(node.attributes || []).map(a => `<span class="xml-attr"><strong>${escapeHtml(a.name)}</strong>="${escapeHtml(a.value)}"</span>`).join(' ');
            const children = Array.from(node.childNodes).map(child => serializeNode(child, isDocBook)).join('');
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

      // Helper function to normalize tag name extraction
      function getTagName(node) {
        return (node.localName || node.nodeName).toLowerCase();
      }

      // Configurable table-like tag detection with comprehensive patterns
      const TABLE_DETECTION_CONFIG = {
        // Container/Parent tags that might hold tabular data
        containerTags: [
          'catalog', 'records', 'data', 'list', 'items', 'collection', 'dataset',
          'table', 'grid', 'matrix', 'array', 'rows', 'entities', 'objects',
          'results', 'entries', 'products', 'books', 'users', 'customers'
        ],
        // Row/Record tags that represent individual data items
        rowTags: [
          'item', 'record', 'row', 'entry', 'entity', 'object', 'element',
          'book', 'product', 'user', 'customer', 'person', 'order', 'result',
          'tr', 'data-row', 'line', 'member', 'node'
        ],
        // Cell/Field tags that represent individual data points
        cellTags: [
          'cell', 'data', 'column', 'field', 'value', 'property', 'attribute',
          'td', 'th', 'col', 'content', 'text', 'info'
        ],
        // Header tags that represent table headers
        headerTags: [
          'header', 'headers', 'thead', 'head', 'title', 'caption', 'label'
        ]
      };

      // Helper function to detect table-like elements
      function isTableElement(tagName) {
        const tag = tagName.toLowerCase();
        return Object.values(TABLE_DETECTION_CONFIG).some(tagArray => 
          tagArray.includes(tag)
        );
      }

      // Advanced data-centric XML structure detection
      function detectDataCentricStructure(node) {
        const tag = getTagName(node);
        const children = Array.from(node.children || []);
        
        // Early exit: DocBook table elements should not be treated as data-centric
        // This protects Paligo-generated tables from being misidentified
        if (['table', 'tgroup', 'thead', 'tbody', 'tfoot'].includes(tag)) {
          return { isDataCentric: false };
        }
        
        // Check if this is a container with repeated child elements (data-centric pattern)
        if (children.length > 0) {
          const childTags = children.map(child => getTagName(child));
          const uniqueTags = [...new Set(childTags)];
          
          // If we have multiple children with the same tag name, this looks like tabular data
          if (uniqueTags.length === 1 && children.length > 1) {
            const sampleChild = children[0];
            const grandChildren = Array.from(sampleChild.children || []);
            
            // Additional check: avoid treating DocBook <row> elements as data-centric
            const childTag = uniqueTags[0];
            if (childTag === 'row' && tag === 'tbody') {
              return { isDataCentric: false };
            }
            
            // Check if child elements have consistent structure (same sub-elements)
            if (grandChildren.length > 0) {
              const hasConsistentStructure = children.every(child => {
                const childElementNames = Array.from(child.children || [])
                  .map(grandChild => getTagName(grandChild));
                return childElementNames.length === grandChildren.length;
              });
              
              if (hasConsistentStructure) {
                return {
                  isDataCentric: true,
                  containerTag: tag,
                  rowTag: uniqueTags[0],
                  rowElements: children,
                  sampleStructure: grandChildren.map(gc => getTagName(gc))
                };
              }
            }
          }
          
          // Check for known container patterns
          if (TABLE_DETECTION_CONFIG.containerTags.includes(tag)) {
            const rowLikeChildren = children.filter(child => {
              const childTag = getTagName(child);
              return TABLE_DETECTION_CONFIG.rowTags.includes(childTag);
            });
            
            if (rowLikeChildren.length > 0) {
              return {
                isDataCentric: true,
                containerTag: tag,
                rowTag: getTagName(rowLikeChildren[0]),
                rowElements: rowLikeChildren,
                sampleStructure: rowLikeChildren[0].children ? 
                  Array.from(rowLikeChildren[0].children).map(c => getTagName(c)) : []
              };
            }
          }
        }
        
        return { isDataCentric: false };
      }

      // Enhanced table converter for generic XML structures
      function convertToHtmlTable(node, isDocBook = false) {
        const tag = getTagName(node);
        
        // Direct HTML table elements - preserve structure
        if (['table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th'].includes(tag)) {
          return convertDirectTableElement(node, isDocBook);
        }
        
        // Generic table-like structures
        if (tag === 'table' || hasTableStructure(node)) {
          return buildHtmlTable(node, isDocBook);
        }
        
        // Row-like elements
        if (['row', 'record', 'tr'].includes(tag)) {
          return buildTableRow(node, false, isDocBook);
        }
        
        // Cell-like elements
        if (['cell', 'data', 'column', 'td', 'th'].includes(tag)) {
          return buildTableCell(node, 'td', isDocBook);
        }
        
        return `<div class="xml-table" data-tag="${escapeHtml(tag)}">${Array.from(node.childNodes).map(child => serializeNode(child, isDocBook)).join('')}</div>`;
      }

      // Convert direct HTML table elements with attribute preservation
      function convertDirectTableElement(node, isDocBook = false) {
        const tag = getTagName(node);
        const attributes = Array.from(node.attributes || [])
          .map(attr => `${attr.name}="${escapeHtml(attr.value)}"`)
          .join(' ');
        
        const children = Array.from(node.childNodes)
          .map(child => child.nodeType === Node.ELEMENT_NODE ? convertToHtmlTable(child, isDocBook) : 
                       child.nodeType === Node.TEXT_NODE && child.nodeValue.trim() ? 
                       escapeHtml(child.nodeValue) : '')
          .filter(Boolean)
          .join('');
        
        return `<${tag}${attributes ? ' ' + attributes : ''}>${children}</${tag}>`;
      }

      // Check if a node has table-like structure (contains rows/records)
      function hasTableStructure(node) {
        const children = Array.from(node.children || []);
        if (children.length === 0) return false;
        
        // Check for explicit row-like elements
        const rowLikeElements = children.filter(child => {
          const tag = getTagName(child);
          return TABLE_DETECTION_CONFIG.rowTags.includes(tag);
        });
        
        // High confidence if most children are row-like elements
        if (rowLikeElements.length > 0 && rowLikeElements.length / children.length > 0.7) {
          return true;
        }
        
        // Medium confidence if we have some consistent structure
        const childTags = children.map(child => getTagName(child));
        const uniqueTags = [...new Set(childTags)];
        
        // If all children have the same tag and there are multiple, likely tabular
        if (uniqueTags.length === 1 && children.length > 1) {
          return true;
        }
        
        // Low confidence fallback - check if children have similar internal structure
        if (children.length > 1) {
          const firstChildElements = children[0].children ? 
            Array.from(children[0].children).map(c => getTagName(c)) : [];
          
          if (firstChildElements.length > 0) {
            const structuralSimilarity = children.filter(child => {
              const childElements = child.children ? 
                Array.from(child.children).map(c => getTagName(c)) : [];
              return childElements.length === firstChildElements.length;
            }).length;
            
            return structuralSimilarity / children.length > 0.6;
          }
        }
        
        return false;
      }

      // Build complete HTML table from generic XML structure
      function buildHtmlTable(node, isDocBook = false) {
        const children = Array.from(node.children || []);
        if (children.length === 0) return '';
        
        let tableContent = '';
        
        // Look for header-like elements
        const headers = children.filter(child => {
          const tag = getTagName(child);
          return TABLE_DETECTION_CONFIG.headerTags.includes(tag);
        });
        
        // Look for body/row elements using enhanced detection
        const rows = children.filter(child => {
          const tag = getTagName(child);
          return TABLE_DETECTION_CONFIG.rowTags.includes(tag) || 
                 (!headers.some(h => h === child) && child.children && child.children.length > 0);
        });
        
        // Build table header if found
        if (headers.length > 0) {
          tableContent += '<thead>';
          headers.forEach(header => {
            tableContent += buildTableRow(header, true, isDocBook);
          });
          tableContent += '</thead>';
        } else if (rows.length > 0) {
          // Generate header from first row's structure if no explicit headers
          const firstRow = rows[0];
          if (firstRow && firstRow.children && firstRow.children.length > 0) {
            tableContent += '<thead><tr>';
            
            // Include attributes as header columns
            if (firstRow.attributes && firstRow.attributes.length > 0) {
              Array.from(firstRow.attributes).forEach(attr => {
                tableContent += `<th>${escapeHtml(attr.name)}</th>`;
              });
            }
            
            // Include child elements as header columns
            Array.from(firstRow.children).forEach(child => {
              const elementName = getTagName(child);
              tableContent += `<th>${escapeHtml(elementName)}</th>`;
            });
            
            tableContent += '</tr></thead>';
          }
        }
        
        // Build table body
        if (rows.length > 0) {
          tableContent += '<tbody>';
          rows.forEach(row => {
            tableContent += buildAdvancedTableRow(row, isDocBook);
          });
          tableContent += '</tbody>';
        }
        
        // If no clear structure, treat all children as rows
        if (!headers.length && !rows.length && children.length > 0) {
          tableContent += '<tbody>';
          children.forEach(child => {
            tableContent += buildAdvancedTableRow(child, isDocBook);
          });
          tableContent += '</tbody>';
        }
        
        return `<table class="xml-generated-table">${tableContent}</table>`;
      }

      // Enhanced table row builder that handles attributes and elements
      function buildAdvancedTableRow(node, isDocBook = false) {
        let rowContent = '';
        
        // Add attributes as cells first
        if (node.attributes && node.attributes.length > 0) {
          Array.from(node.attributes).forEach(attr => {
            rowContent += `<td>${escapeHtml(attr.value)}</td>`;
          });
        }
        
        // Add child elements as cells
        if (node.children && node.children.length > 0) {
          Array.from(node.children).forEach(child => {
            const content = child.children && child.children.length > 0 ? 
              Array.from(child.childNodes).map(c => serializeNode(c, isDocBook)).join('') :
              escapeHtml(getTextContent(child));
            rowContent += `<td>${content}</td>`;
          });
        } else {
          // If no children, use the node's text content
          const textContent = getTextContent(node);
          if (textContent.trim()) {
            rowContent += `<td>${escapeHtml(textContent)}</td>`;
          }
        }
        
        return `<tr>${rowContent}</tr>`;
      }

      // Build table row from XML element
      function buildTableRow(node, isHeader = false, isDocBook = false) {
        const children = Array.from(node.children || []);
        const cellTag = isHeader ? 'th' : 'td';
        
        // If node has cell-like children, use them
        const cells = children.filter(child => {
          const tag = getTagName(child);
          return ['cell', 'data', 'column', 'td', 'th', 'field', 'value'].includes(tag);
        });
        
        let rowContent = '';
        
        if (cells.length > 0) {
          cells.forEach(cell => {
            rowContent += buildTableCell(cell, cellTag, isDocBook);
          });
        } else if (children.length > 0) {
          // Treat all children as cells
          children.forEach(child => {
            rowContent += buildTableCell(child, cellTag, isDocBook);
          });
        } else {
          // No children, use text content
          const textContent = getTextContent(node);
          if (textContent.trim()) {
            rowContent += `<${cellTag}>${escapeHtml(textContent)}</${cellTag}>`;
          }
        }
        
        return `<tr>${rowContent}</tr>`;
      }

      // Build table cell from XML element
      function buildTableCell(node, cellTag = 'td', isDocBook = false) {
        const attributes = [];
        
        // Handle colspan and rowspan attributes
        if (node.hasAttribute && node.hasAttribute('colspan')) {
          attributes.push(`colspan="${escapeHtml(node.getAttribute('colspan'))}"`);
        }
        if (node.hasAttribute && node.hasAttribute('rowspan')) {
          attributes.push(`rowspan="${escapeHtml(node.getAttribute('rowspan'))}"`);
        }
        if (node.hasAttribute && node.hasAttribute('span')) {
          attributes.push(`colspan="${escapeHtml(node.getAttribute('span'))}"`);
        }
        
        const attrString = attributes.length > 0 ? ' ' + attributes.join(' ') : '';
        const content = node.children && node.children.length > 0 ? 
          Array.from(node.childNodes).map(c => serializeNode(c, isDocBook)).join('') :
          escapeHtml(getTextContent(node));
        
        return `<${cellTag}${attrString}>${content}</${cellTag}>`;
      }

      // Helper to get text content from node
      function getTextContent(node) {
        if (node.textContent !== undefined) {
          return node.textContent;
        }
        if (node.nodeValue) {
          return node.nodeValue;
        }
        let text = '';
        for (let child of node.childNodes || []) {
          if (child.nodeType === Node.TEXT_NODE) {
            text += child.nodeValue || '';
          }
        }
        return text;
      }

      // Build comprehensive HTML table from data-centric XML structures
      function buildDataCentricTable(containerNode, dataCentricInfo, isDocBook = false) {
        const { rowElements } = dataCentricInfo;
        
        if (rowElements.length === 0) return '';
        
        // Analyze all row elements to build comprehensive column structure
        const allColumns = new Set();
        const attributeColumns = new Set();
        
        // First pass: collect all possible column names from child elements and attributes
        rowElements.forEach(rowElement => {
          // Add attributes as columns
          if (rowElement.attributes) {
            Array.from(rowElement.attributes).forEach(attr => {
              attributeColumns.add(attr.name);
              allColumns.add(`@${attr.name}`); // Prefix attributes with @
            });
          }
          
          // Add child element names as columns
          if (rowElement.children) {
            Array.from(rowElement.children).forEach(child => {
              const elementName = getTagName(child);
              allColumns.add(elementName);
            });
          }
        });
        
        // Convert to sorted array for consistent column order (attributes first, then elements)
        const columnHeaders = [
          ...Array.from(attributeColumns).sort().map(attr => `@${attr}`),
          ...Array.from(allColumns).filter(col => !col.startsWith('@')).sort()
        ];
        
        let tableHtml = '<table class="xml-data-centric-table">';
        
        // Build table header
        if (columnHeaders.length > 0) {
          tableHtml += '<thead><tr>';
          columnHeaders.forEach(header => {
            const displayName = header.startsWith('@') ? 
              header.substring(1) : // Remove @ prefix for display
              header;
            tableHtml += `<th>${escapeHtml(displayName)}</th>`;
          });
          tableHtml += '</tr></thead>';
        }
        
        // Build table body
        tableHtml += '<tbody>';
        rowElements.forEach(rowElement => {
          tableHtml += '<tr>';
          
          columnHeaders.forEach(columnName => {
            let cellContent = '';
            
            if (columnName.startsWith('@')) {
              // Handle attribute columns
              const attrName = columnName.substring(1);
              const attrValue = rowElement.getAttribute ? rowElement.getAttribute(attrName) : '';
              cellContent = attrValue || '';
            } else {
              // Handle element columns
              const childElement = Array.from(rowElement.children || [])
                .find(child => getTagName(child) === columnName);
              
              if (childElement) {
                // Check if element has children (complex content) or just text
                if (childElement.children && childElement.children.length > 0) {
                  // Complex content - serialize recursively
                  cellContent = Array.from(childElement.childNodes)
                    .map(child => {
                      if (child.nodeType === Node.ELEMENT_NODE) {
                        return serializeNode(child, isDocBook);
                      } else if (child.nodeType === Node.TEXT_NODE && child.nodeValue.trim()) {
                        return escapeHtml(child.nodeValue);
                      }
                      return '';
                    })
                    .filter(Boolean)
                    .join('');
                } else {
                  // Simple text content
                  cellContent = escapeHtml(getTextContent(childElement));
                }
              }
            }
            
            tableHtml += `<td>${cellContent}</td>`;
          });
          
          tableHtml += '</tr>';
        });
        tableHtml += '</tbody></table>';
        
        return tableHtml;
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

        // Enhanced DocBook detection:
        // 1. Check namespace for DocBook
        // 2. Check if root is a known DocBook element
        // 3. Check if root is a table with DocBook structure (tgroup, colspec, etc.)
        const hasDocBookNamespace = ns && ns.indexOf('docbook') !== -1;
        const hasDocBookRootElement = /^(article|section|chapter|book|bookinfo)$/i.test(localName);
        const hasDocBookTableStructure = localName === 'table' && 
          (xmlDoc.querySelector('tgroup, colspec, thead, tbody') !== null);
        
        const looksLikeDocBook = hasDocBookNamespace || hasDocBookRootElement || hasDocBookTableStructure;

        // Enhanced table detection for any XML structure - combined into single selector for performance
        const hasTableElements = xmlDoc.querySelector(
          'table, thead, tbody, tr, td, th, row, cell, record, data, column, item, entry, ' +
          'catalog, records, list, items, collection'
        ) !== null;

        if (looksLikeDocBook) {
          // Use existing XSLT stylesheet for DocBook XML (Paligo-generated tables)
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
            // otherwise continue to generic fallback with isDocBook flag
          } catch (err) {
            console.warn('DocBook XSLT path failed, falling back to generic XML serializer:', err);
            // fallthrough to generic serializer with isDocBook flag
          }
        }

        // Generic fallback: produce readable HTML for any XML
        // Pass isDocBook flag to prevent data-centric interference with DocBook tables
        const html = serializeNode(xmlDoc, looksLikeDocBook);
        const containerClass = hasTableElements ? 'generic-xml has-tables' : 'generic-xml';
        return `<div class="${containerClass}">${html}</div>`;
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