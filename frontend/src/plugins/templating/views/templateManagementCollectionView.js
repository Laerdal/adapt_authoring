// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE

requirejs.config({
  waitSeconds: 10,
  paths: {
    "datatables": "//cdn.datatables.net/1.10.13/js/jquery.dataTables.min",
  }

});
define(function (require) {
  var Origin = require('core/origin');
  var OriginView = require('core/views/originView');
  const TemplateHelper = require('../utils/templatingHelper');

  var TemplateCollectionView = OriginView.extend(
    {
      className: 'template-management-collection',

      sort: { createdAt: -1 },
      search: {},
      filters: [],
      tags: [],
      fetchCount: 0,
      shouldStopFetches: false,
      pageSize: 1,

      preRender: function (options) {
        // if(options.search) {
        //   this.search = options.search;
        //   var assetType = this.search.assetType;
        //   if(assetType) this.filters = assetType.$in;
        // }
        this.initEventListeners();

        // this._doLazyScroll = _.bind(_.throttle(this.doLazyScroll, 250), this);
        // this._onResize = _.bind(_.debounce(this.onResize, 400), this);
      },

      postRender: function () {
        this.fetchCollection();
        // this.initPaging();
        // init lazy scrolling
        // $('.template-management-assets-container').on('scroll', this._doLazyScroll);
        // $(window).on('resize', this._onResize);
      },

      initEventListeners: function () {
        this.listenTo(Origin, {
          'templateManagement:sidebarFilter:add': this.addFilter,
          'templateManagement:sidebarFilter:remove': this.removeFilter,
          'templateManagement:sidebarView:filter': this.filterBySearchInput,
          'templateManagement:assetManagementSidebarView:filterByTags':
            this.filterByTags,
          'templateManagement:collection:refresh': this.resetCollection,
        });
        this.listenTo(this.collection, 'add', this.appendTemplateItem);
      },

      initPaging: function () {
        this.resetCollection(
          _.bind(function (collection) {
            var containerHeight = $(
              '.template-management-assets-container'
            ).outerHeight();
            var containerWidth = $(
              '.template-management-assets-container'
            ).outerWidth();
            var itemHeight = $('.template-management-list-item').outerHeight(
              true
            );
            var itemWidth = $('.template-management-list-item').outerWidth(
              true
            );
            var columns = Math.floor(containerWidth / itemWidth);
            var rows = Math.floor(containerHeight / itemHeight);
            // columns stack nicely, but need to add extra row if it's not a clean split
            if (containerHeight % itemHeight > 0) rows++;
            this.pageSize = columns * rows;

            // need another reset to get the actual pageSize number of items
            this.resetCollection(this.setViewToReady);
          }, this)
        );
      },

      addedDataTable: function (response) {
        const userId = Origin.sessionModel.get('id');
    // const url = `api/content/templating?createdBy=${userId}`;

    // Filter the response to only include rows where createdBy matches the userId
    const filteredResponse = response.filter(item => item.createdBy === userId);
        require(["datatables"], function () {
          $(function () {
            // initialize DataTables
            if (!$.fn.DataTable.isDataTable('.template-management-list')) {
            let templateTable = $(".template-management-list").DataTable({
              data: filteredResponse, // Pass the data array to DataTables
              // data: response, // Pass the data array to DataTables
              columns: [          // Define the column structure
                { title: 'Template title', data: 'title' },
                { title: 'Type', data: 'referenceType', 
                  render: function(data, type, row) {
                  // Conditional rendering: if referenceType is 'contentobject', display 'page'
                  return data === 'contentobject' ? 'page' : data;
                  } 
                },
                { title: 'Description', data: 'description'},
                { title: 'Time Stamp', data: 'createdAt', 
                  render: function(data, type, row) {
                  // Create a new Date object from the ISO string
                    let date = new Date(data);
                    // Format the date to 'DD/MM/YYYY, HH:mm am/pm'
                    let options = {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    };
                    let formattedDate = new Intl.DateTimeFormat('en-GB', options).format(date);

                    return formattedDate;
                  } 
                },
                {               // Actions column for Edit and Delete icons
                  title: 'Action(s)',
                  orderable: false, // Disable sorting for this column
                  render: function (data, type, row, meta) {
                    return `
                      <button class="edit-btn tempEdit" data-courseId=${row._courseId} data-referenceId=${row._referenceId} data-referencetype=${row.referenceType} data-row="${meta.row}" title="Edit"></button>
                      <button class="delete-btn tempTrash" data-courseId=${row._courseId} data-referenceId=${row._referenceId} data-referencetype=${row.referenceType} data-row="${meta.row}" title="Delete"></button>
                      <button class="save-btn btn primary tempSave" data-courseId=${row._courseId} data-referenceId=${row._referenceId} data-referencetype=${row.referenceType} data-row="${meta.row}" style='display:none;'>Save</button>
                      <button class="close-btn tempClose" style='display:none;'></button>
                    `;
                  }
                }
              ],
              paging: true,       // Enable pagination
              ordering: true,     // Enable sorting
              info: true,         // Show table information
              pageLength: 10,      // Set the page length to 5 rows per page
              autoWidth: false,   // Disable automatic column width calculation
              responsive: true,   // Make table responsive
              dom: '<"top"f>rt<"bottom"l ip><"clear">', // Customize table layout
              language: {
                lengthMenu: 'Rows per page: _MENU_', // Customize pagination dropdown text
                info: '_START_-_END_ of _TOTAL_', // Customize info text
                infoEmpty: "0-0 of _TOTAL_", // Customize this text for empty tables
                infoFiltered: '', // Hide the infoFiltered text
                search: "",       // Remove the "Search:" label
                searchPlaceholder: "Search", // Optional: add a placeholder in the search input field
                paginate: {
                  previous: '', // Customize previous button
                  next: '' // Customize next button
                }   
              },
              pagingType: "simple", // Use simple pagination (only Previous and Next buttons)
              createdRow: function(row, data, dataIndex) {
                // Add a unique ID to the row
                $(row).attr('id', data._id);  // Assuming 'id' is a unique identifier in your data
              }
            });
          


            // Check if the filters are already inserted
    if (!$('.custom-filters').length) {
             // Insert the custom filter controls into the DataTable's wrapper
          let filterHtml = `
            <div class="custom-filters">
              <label class="custom-radio">
                <input type="radio" name="template-filter" value="all" checked>
                <span class="custom-radio-label">All</span>
              </label>
              <label class="custom-radio">
                <input type="radio" name="template-filter" value="Page">
                <span class="custom-radio-label">Page</span>
              </label>
              <label class="custom-radio">
                <input type="radio" name="template-filter" value="Article">
                <span class="custom-radio-label">Article</span>
              </label>
              <label class="custom-radio">
                <input type="radio" name="template-filter" value="Block">
                <span class="custom-radio-label">Block</span>
              </label>
              <label class="custom-radio">
                <input type="radio" name="template-filter" value="Component">
                <span class="custom-radio-label">Component</span>
              </label>
            </div>
          `;
          $('.dataTables_wrapper .dataTables_filter').before(filterHtml);
    }

            // Radio filter functionality
            $('input[name="template-filter"]').on('change', function() {
              let template = $(this).val();
              if (template === 'all') {
                templateTable.columns(1).search('').draw(); // Clear search filter
              } else {
                templateTable.columns(1).search(template).draw(); // Filter by office
              }
            });

            // Save button click handler
            $('.template-management-list').on('click', '.save-btn', async function(e) {
              let idValue = $(this).closest('tr').attr('id');
              let $findTableFirstRow = $(this).closest('tr').find('td:first input').val();
              let $findTableThreeRow = $(this).closest('tr').find('td:nth-child(3) input').val();
              let courseId = $(this).attr('data-courseid');
              let referenceId = $(this).attr('data-referenceid');
              let referenceType = $(this).attr('data-referencetype');
              try {
                const result = await updateTemplate(idValue, $findTableFirstRow, $findTableThreeRow, courseId, referenceId, referenceType, this);
                if (result.success) {
                  let templateTitle = $(this).closest('tr').find('td:first input').val();
                  let templateDescription = $(this).closest('tr').find('td:nth-child(3) input').val();
                  $(this).closest('tr').find('td:first').empty().text(templateTitle);
                  $(this).closest('tr').find('td:nth-child(3)').empty().text(templateDescription);
                  $(this).parent().find('.tempTrash, .tempEdit').show();
                  $(this).parent().find('.tempSave, .tempClose').hide();
                  Origin.Notify.snackbar('Template saved');
                  // You can handle UI updates or success messages here
                } else {
                  console.log('Error updating template', result);
                }
              } catch (error) {
                console.error('Error updating template:', error);
              }
            });

            // Close button click handler
            $('.template-management-list').on('click', '.close-btn', function(e) {
              let $findTableFirstRow = $(this).closest('tr').find('td:first');
              let $findTableThreeRow = $(this).closest('tr').find('td:nth-child(3)');
              $findTableFirstRow.text($findTableFirstRow.find('input').val());
              $findTableThreeRow.text($findTableThreeRow.find('input').val());
              $(this).parent().find('.tempTrash, .tempEdit').show();
              $(this).parent().find('.tempSave, .tempClose').hide();              
            $(this).closest('tr').find('td').css({'padding-top': '16px', 'padding-bottom': '16px'});
            });

            // Edit button click handler
            $('.template-management-list').on('click', '.edit-btn', function(e) {
              let $findTableFirstRow = $(this).closest('tr').find('td:first');
              let $findTableThreeRow = $(this).closest('tr').find('td:nth-child(3)');
            // Replace the cell content with an input field, pre-filled with the current content
            let firstCellContent = $findTableFirstRow.text().trim();
            let thirdCellContent = $findTableThreeRow.text().trim();

            // Build inputs via the DOM and set the value with .val() so that
            // template titles/descriptions containing quotes or markup can't
            // break the attribute or inject HTML.
            $findTableFirstRow.empty().append(
              $('<input type="text" class="editTemplate" />').val(firstCellContent)
            );
            $findTableThreeRow.empty().append(
              $('<input type="text" class="editTemplate" />').val(thirdCellContent)
            );
            $(this).parent().find('.tempTrash, .tempEdit').hide();
            $(this).parent().find('.tempSave, .tempClose').show();
            $(this).closest('tr').find('td').css({'padding-top': '8px', 'padding-bottom': '8px'});
              var rowIndex = $(this).data('row');
              templateTable.row(rowIndex).data();
            });

            // Delete button click handler
            $('.template-management-list').on('click', '.delete-btn', function(e) {
              var rowIndex = $(this).data('row');
              let idValue = $(this).closest('tr').attr('id');
              let courseId = $(this).attr('data-courseid');
              let referenceId = $(this).attr('data-referenceid');
              let referenceType = $(this).attr('data-referencetype');
              if (referenceType === 'contentobject') referenceType = 'page';
              Origin.Notify.confirm({
                type: 'warning',
                title: Origin.l10n.t('app.deleteTempelate'),
                text: Origin.l10n.t('app.confirmdeletetemplate') + '<br /> <br />' + Origin.l10n.t('app.confirmdeletetemplatewarning') + '<br />',
                callback: function(isConfirmed) {
                  onConfirmRemovePopup(isConfirmed, idValue, courseId, referenceId, referenceType);
                }
              });
              
              // templateTable.row(rowIndex).remove().draw(); // Remove the row from the table
              function onConfirmRemovePopup(isConfirmed, idValue, courseId, referenceId, referenceType) {
                if (isConfirmed) {
                  TemplateHelper.deleteTemplateList(idValue, courseId, referenceId, referenceType);
                  templateTable.row(`#${idValue}`).remove().draw(false); // Remove the row from the table
                } else {
                  console.log('Template not deleted');
                }
              }
            });
          } else {
            // Table already initialised (filter / refresh / refetch): refresh
            // its data so the latest response is shown instead of a stale table.
            $('.template-management-list').DataTable().clear().rows.add(filteredResponse).draw();
          }

            async function updateTemplate(id, newTitle, newDescription, courseId, referenceId, referenceType, self) {

                  const data = {
                    title: newTitle,        
                    description: newDescription, 
                  };
          
                  const response = await fetch(`api/content/templating/${id}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data),
                  });
                  const result = await response.json();
                  return result;
             
            }
            
          

          });
        });
      },

      appendTemplateItem: function (template) {
        
      },

      /**
       * Collection manipulation
       */

      fetchCollection: function (cb) {
        if (this.shouldStopFetches || this.isCollectionFetching) {
          return;
        }
        this.isCollectionFetching = true;

        this.collection.fetch({
          //   data: {
          //     search: _.extend(this.search, {
          //       tags: { $all: this.tags },
          //       assetType: { $in: this.filters }
          //     }),
          //     operators : {
          //       skip: this.fetchCount,
          //       limit: this.pageSize,
          //       sort: this.sort
          //     }
          //   },
          success: _.bind(function (collection, response) {
            this.isCollectionFetching = false;
            this.fetchCount += response.length;
            // stop further fetching if this is the last page
            if (response.length < this.pageSize) this.shouldStopFetches = true;

            $('.template-management-no-assets').toggleClass(
              'display-none',
              this.fetchCount > 0
            );

            Origin.trigger(
              'templateManagement:templateManagementCollection:fetched'
            );
            if (typeof cb === 'function') cb(collection);
            this.addedDataTable(response);
          }, this),
          error: function (error) {
            console.log(error);
            this.isCollectionFetching = false;
          },
        });
      },

      resetCollection: function (cb, shouldFetch) {
        // to remove old views
        Origin.trigger('templateManagement:assetViews:remove');

        this.shouldStopFetches = false;
        this.fetchCount = 0;
        this.collection.reset();

        if (shouldFetch === undefined || shouldFetch === true) {
          this.fetchCollection(cb);
        }
      },

      /**
       * Filtering
       */

      filterCollection: function () {
        this.resetCollection(null, false);
        this.search.assetType = this.filters.length
          ? { $in: this.filters }
          : null;
        this.fetchCollection();
      },

      addFilter: function (filterType) {
        this.filters.push(filterType);
        this.filterCollection();
      },

      removeFilter: function (filterType) {
        // remove filter from this.filters
        this.filters = _.filter(this.filters, function (item) {
          return item !== filterType;
        });
        this.filterCollection();
      },

      filterBySearchInput: function (filterText) {
        this.resetCollection(null, false);
        var pattern = '.*' + filterText.toLowerCase() + '.*';
        this.search = { title: pattern, description: pattern };
        this.fetchCollection();

        $('.template-management-modal-filter-search').focus();
      },

      filterByTags: function (tags) {
        this.resetCollection(null, false);
        this.tags = _.pluck(tags, 'id');
        this.fetchCollection();
      },

      /**
       * Event handling
       */

      onResize: function () {
        this.initPaging();
      },

      doLazyScroll: function (e) {
        if (this.isCollectionFetching) {
          return;
        }
        var $el = $(e.currentTarget);
        var scrollableHeight = this.$el.height() - this.$el.height();
        var pxRemaining = this.$el.height() - ($el.scrollTop() + $el.height());
        var scrollTriggerAmmount =
          $('.template-management-list-item').first().outerHeight() / 2;
        // we're at the bottom, fetch more
        if (pxRemaining <= scrollTriggerAmmount) this.fetchCollection();
      },

      remove: function () {
        $('.template-management-assets-container').off(
          'scroll',
          this._doLazyScroll
        );
        $(window).off('resize', this._onResize);

        OriginView.prototype.remove.apply(this, arguments);
      },
    },
    {
      template: 'templateManagementCollection',
    }
  );
  return TemplateCollectionView;
});
