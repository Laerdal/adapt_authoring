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
  'jquery',
  'underscore',
  'backbone',
  'backbone-forms',
  './backboneFormsOverrides'
], function($, _, Backbone) {

  // ---- constants ----

  // Unique counter for tooltip instance namespacing and ARIA association
  var tooltipInstanceId = 0;

  // Viewport edge padding (px) used for tooltip placement clamping
  var TOOLTIP_VIEWPORT_MARGIN = 8;

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
    var $target = $(e.currentTarget);
    // mouseenter fires on .field-help; focus fires on .field-help i
    var $icon = $target.is('i') ? $target : $target.find('i').first();
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
    // Always set aria-describedby and aria-controls; generate id only if missing
    if (!$tooltip.attr('id')) {
      $tooltip.attr('id', 'tooltip-' + (++tooltipInstanceId));
    }
    var tooltipId = $tooltip.attr('id');
    $icon.attr({
      'aria-describedby': tooltipId,
      'aria-controls': tooltipId
    });

    // Render tooltip hidden for measurement; pointer-events stay disabled (CSS default)
    $tooltip.css({ display: 'block', opacity: 0 });
    var iconRect = $icon[0].getBoundingClientRect();

    // Ensure the tooltip never exceeds viewport width minus margins
    var maxAllowedWidth = window.innerWidth - TOOLTIP_VIEWPORT_MARGIN * 2;
    if ($tooltip.outerWidth() > maxAllowedWidth) {
      $tooltip.css('max-width', maxAllowedWidth + 'px');
    }

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
      pointerEvents: 'auto'  // allow hover/interaction while visible
    }).attr('aria-hidden', 'false');

    // Set aria-expanded on icon to reflect tooltip state for assistive tech
    $icon.attr('aria-expanded', 'true');

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
    var $target = $(e.currentTarget);
    var $icon = $target.is('i') ? $target : $target.find('i').first();
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

    // Reset aria-expanded on icon to reflect tooltip state
    $icon.attr('aria-expanded', 'false');

    if (immediate) {
      $tooltip.css({ top: '', left: '', opacity: 0, display: 'none', pointerEvents: '', maxWidth: '' })
        .attr('aria-hidden', 'true');
    } else {
      // Fade out: pointer-events revert to CSS default (none) so the
      // transparent tooltip cannot block clicks during the animation.
      $tooltip.css({ opacity: 0, pointerEvents: '' });
      
      // Read fade duration from CSS to avoid hard-coding and maintain single source of truth
      var transitionDuration = parseFloat(window.getComputedStyle($tooltip[0]).transitionDuration) * 1000 || 300;
      
      var hideTimeout = setTimeout(function() {
        // Guard against element being removed from the DOM during fade
        if (!$.contains(document.documentElement, $tooltip[0])) return;
        $tooltip.css({ top: '', left: '', display: 'none', maxWidth: '' })
          .attr('aria-hidden', 'true');
        $tooltip.removeData('hideTimeout');
      }, transitionDuration);
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
    'mouseenter .field-help': showTooltip,
    'mouseleave .field-help': hideTooltip,
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
