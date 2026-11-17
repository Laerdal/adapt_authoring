/**
 * Component `_layout` ordering.
 *
 * Components do not persist a `_sortOrder`, so the order in which a block's
 * components are exported would otherwise be the database's natural order. The
 * Adapt framework stacks components in that order on small screens, so a block
 * with a 'left' and a 'right' component must always list 'left' first.
 */

function isLeftRightPair(first, second) {
  return !!first && !!second &&
    ((first._layout === 'left' && second._layout === 'right') ||
     (first._layout === 'right' && second._layout === 'left'));
}

/**
 * Orders the children of a single block. Only a pair of exactly one 'left' and
 * one 'right' component is reordered (left first); anything else is returned
 * unchanged.
 * @param {Array} children
 * @return {Array} a new array
 */
function orderBlockComponents(children) {
  var list = Array.isArray(children) ? children.slice() : [];
  if (list.length === 2 && isLeftRightPair(list[0], list[1]) && list[0]._layout === 'right') {
    list.reverse();
  }
  return list;
}

/**
 * Orders a flat list of components (e.g. a whole course). Each block's
 * left/right pair is put in left-then-right order within the slots that pair
 * already occupied, so the relative position of every other component is kept.
 * @param {Array} components
 * @return {Array} a new array
 */
function orderComponentsByLayout(components) {
  var list = Array.isArray(components) ? components.slice() : [];
  var slotsByParent = {};

  list.forEach(function(component, index) {
    var parentId = component && component._parentId;
    if (parentId === undefined || parentId === null) return;
    var key = String(parentId);
    (slotsByParent[key] = slotsByParent[key] || []).push(index);
  });

  Object.keys(slotsByParent).forEach(function(key) {
    var slots = slotsByParent[key];
    if (slots.length !== 2) return;
    var first = list[slots[0]];
    var second = list[slots[1]];
    if (isLeftRightPair(first, second) && first._layout === 'right') {
      list[slots[0]] = second;
      list[slots[1]] = first;
    }
  });

  return list;
}

module.exports = {
  orderBlockComponents: orderBlockComponents,
  orderComponentsByLayout: orderComponentsByLayout
};
