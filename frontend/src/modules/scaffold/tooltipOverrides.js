/**
 * Tooltip overrides for Backbone.Form.Field  (ADAPT-3588)
 *
 * Laerdal customisation – this is the ONLY file that contains the tooltip
 * event handlers (mouseenter/leave, focus/blur, keydown) and positioning
 * logic.  backboneFormsOverrides.js is NOT modified for tooltip behaviour;
 * this module extends the events object that backboneFormsOverrides sets.
 *
 * Companion CSS lives in less/tooltip.less.
 *
 * Uses position:fixed with JavaScript-based viewport-aware placement,
 * ARIA attributes, keyboard accessibility, and proper cleanup on field
 * removal.
 *
 * Kept separate so upstream Adapt community pulls do not overwrite it.
 */
define([
  'backbone-forms',
  './backboneFormsOverrides'
], function() {

  // ---- constants ----

  // Unique counter for tooltip instance namespacing and ARIA association
  var tooltipInstanceId = 0;

  // Viewport edge padding (px) used for tooltip placement clamping
  var TOOLTIP_VIEWPORT_MARGIN = 8;

  // Duration (ms) matching the CSS opacity transition for fade-out
  var TOOLTIP_FADE_DURATION = 300;

  // ---- store original remove so we can call it in our override ----
  var fieldRemove = Backbone.Form.Field.prototype.remove;

  // ---- tooltip show / hide / dismiss helpers ----

  /**
   * Collect every scrollable ancestor between the icon and <html>.
   * Used to bind scroll-dismiss listeners so that scrolling a container
   * like .scaffold-items-modal-sidebar also hides the tooltip.
   */
  var getScrollableAncestors = function($el) {
    var ancestors = [];
    $el.parents().each(function() {
      var style = window.getComputedStyle(this);
      var overflow = style.overflowY || style.overflow;
      if (overflow === 'auto' || overflow === 'scroll') {
        ancestors.push(this);
      }
    });
    return ancestors;
  };

  var showTooltip = function(e) {
    var $icon = $(e.currentTarget);
    var $tooltip = $icon.siblings('.tooltip');
    if (!$tooltip.length) return;

    // Dismiss all other visible tooltips scoped to the closest form container,
    // using dismissTooltip to ensure their window event handlers are cleaned up
    var $form = $icon.closest('.form-container, form');
    var $scope = $form.length ? $form : $(document);
    $scope.find('.field-help .tooltip').not($tooltip).each(function() {
      var $t = $(this);
      var $otherIcon = $t.siblings('i');
      var otherNs = '.tooltip-' + ($t.attr('id') || '');
      dismissTooltip($otherIcon, $t, otherNs, true);
    });

    // Clear any pending hide timeout for this tooltip
    var pendingTimeout = $tooltip.data('hideTimeout');
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      $tooltip.removeData('hideTimeout');
    }

    // Ensure ARIA association between icon and tooltip
    if (!$tooltip.attr('id')) {
      var tooltipId = 'tooltip-' + (++tooltipInstanceId);
      $tooltip.attr('id', tooltipId);
      $icon.attr('aria-describedby', tooltipId);
    }

    // Make tooltip off-screen but rendered to measure its dimensions.
    // pointer-events:auto ensures the tooltip can be interacted with when visible.
    $tooltip.css({ display: 'block', opacity: 0, pointerEvents: 'none' });
    var iconRect = $icon[0].getBoundingClientRect();
    var tooltipWidth = $tooltip.outerWidth();
    var tooltipHeight = $tooltip.outerHeight();

    var spaceBelow = window.innerHeight - iconRect.bottom;

    // Vertical: prefer below, use above if not enough space below
    var top;
    if (spaceBelow >= tooltipHeight + TOOLTIP_VIEWPORT_MARGIN) {
      top = iconRect.bottom + TOOLTIP_VIEWPORT_MARGIN;
    } else {
      top = iconRect.top - tooltipHeight - TOOLTIP_VIEWPORT_MARGIN;
    }

    // Horizontal: align left edge to icon, clamp to viewport
    var left = iconRect.left;
    if (left + tooltipWidth > window.innerWidth - TOOLTIP_VIEWPORT_MARGIN) {
      left = window.innerWidth - tooltipWidth - TOOLTIP_VIEWPORT_MARGIN;
    }
    left = Math.max(TOOLTIP_VIEWPORT_MARGIN, left);

    // Clamp vertical to viewport
    top = Math.max(TOOLTIP_VIEWPORT_MARGIN, Math.min(top, window.innerHeight - tooltipHeight - TOOLTIP_VIEWPORT_MARGIN));

    $tooltip.css({
      top: top + 'px',
      left: left + 'px',
      opacity: 0.9,
      pointerEvents: 'auto'
    }).attr('aria-hidden', 'false');

    // Dismiss tooltip on window scroll/resize and on scrollable-ancestor scroll
    var ns = '.tooltip-' + $tooltip.attr('id');
    var dismiss = function() {
      dismissTooltip($icon, $tooltip, ns, false);
    };
    $(window).off(ns);
    $(window).on('scroll' + ns + ' resize' + ns, dismiss);

    // Also bind to every scrollable ancestor (e.g. .scaffold-items-modal-sidebar)
    var scrollParents = getScrollableAncestors($icon);
    $tooltip.data('scrollParents', scrollParents);
    $(scrollParents).off(ns);
    $(scrollParents).on('scroll' + ns, dismiss);
  };

  var hideTooltip = function(e) {
    var $icon = $(e.currentTarget);
    var $tooltip = $icon.siblings('.tooltip');
    if (!$tooltip.length) return;

    var ns = '.tooltip-' + ($tooltip.attr('id') || '');
    dismissTooltip($icon, $tooltip, ns, false);
  };

  // Core dismiss logic using direct element references (not event.currentTarget).
  // When immediate=true, hides instantly without fade (used when replacing one tooltip with another).
  var dismissTooltip = function($icon, $tooltip, ns, immediate) {
    // Clear any existing hide timeout
    var existingTimeout = $tooltip.data('hideTimeout');
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      $tooltip.removeData('hideTimeout');
    }

    if (immediate) {
      $tooltip.css({ top: '', left: '', opacity: 0, display: 'none', pointerEvents: 'none' })
        .attr('aria-hidden', 'true');
    } else {
      // Fade out: disable pointer events immediately so the invisible tooltip
      // cannot block clicks on underlying elements during the animation.
      $tooltip.css({ opacity: 0, pointerEvents: 'none' });
      var hideTimeout = setTimeout(function() {
        // Guard against element being removed from the DOM during fade
        if (!$.contains(document.documentElement, $tooltip[0])) return;
        $tooltip.css({ top: '', left: '', display: 'none' })
          .attr('aria-hidden', 'true');
        $tooltip.removeData('hideTimeout');
      }, TOOLTIP_FADE_DURATION);
      $tooltip.data('hideTimeout', hideTimeout);
    }
    // Clean up window and scrollable-ancestor listeners
    $(window).off(ns);
    var scrollParents = $tooltip.data('scrollParents');
    if (scrollParents) {
      $(scrollParents).off(ns);
      $tooltip.removeData('scrollParents');
    }
  };

  // ---- extend Field.prototype.events with tooltip handlers ----

  var existingEvents = Backbone.Form.Field.prototype.events || {};

  Backbone.Form.Field.prototype.events = _.extend({}, existingEvents, {
    'mouseenter .field-help i': showTooltip,
    'mouseleave .field-help i': hideTooltip,
    'focus .field-help i': showTooltip,
    'blur .field-help i': hideTooltip,
    'keydown .field-help i': function(e) {
      // Activate tooltip on Enter or Space for role="button" accessibility
      var key = e.key || e.keyCode || e.which;
      if (key === 'Enter' || key === ' ' || key === 13 || key === 32) {
        e.preventDefault();
        var $icon = $(e.currentTarget);
        var $tooltip = $icon.siblings('.tooltip');
        var isVisible = $tooltip.length && $tooltip.css('display') !== 'none';
        if (isVisible) {
          hideTooltip(e);
        } else {
          showTooltip(e);
        }
      }
    }
  });

  // ---- cleanup on field removal ----

  Backbone.Form.Field.prototype.remove = function() {
    var $el = this.$el;
    $el.find('.field-help .tooltip').each(function() {
      var $t = $(this);
      var existingTimeout = $t.data('hideTimeout');
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        $t.removeData('hideTimeout');
      }
      var ns = '.tooltip-' + ($t.attr('id') || '');
      $(window).off(ns);
      var scrollParents = $t.data('scrollParents');
      if (scrollParents) {
        $(scrollParents).off(ns);
        $t.removeData('scrollParents');
      }
    });
    return fieldRemove.apply(this, arguments);
  };

});
