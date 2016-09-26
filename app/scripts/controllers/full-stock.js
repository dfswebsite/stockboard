'use strict';

/**
 * @ngdoc function
 * @name superstockApp.controller:FullStockCtrl
 * @description
 * # FullStockCtrl
 * Controller of the superstockApp
 */
angular.module('superstockApp')
    .controller('FullStockCtrl', ['$rootScope', '$scope', 'auth', '$firebaseArray',
        '$firebaseObject', 'Ref', 'draw', 'uiGridConstants', '$sce', 'utils', 'currentAuth', '$window', '$compile', '$filter', '$timeout',
        function ($rootScope, $scope, auth, $firebaseArray,
            $firebaseObject, Ref, draw, uiGridConstants, $sce, utils, currentAuth, $window, $compile, $filter, $timeout) {
            $rootScope.link = 'full'; //set this page is full-page
            $window.ga('send', 'event', "Page", "Đầy đủ");
            var userFilters = null;
            var user = null;
            var userAuthData = null;
            var filterData = null;
            var filterChangeFlag = 0;
            var filterOnOff = false;
            $rootScope.filterList = {};

            //check user login
            if (currentAuth) {
                var filter = $firebaseObject(Ref.child('users/' + currentAuth.uid + '/filter'));
                filter.$loaded(function (data) {
                    filterData = {};
                    for (var i in data) {
                        if (i.charAt(0) != '$' && i != 'forEach') {
                            filterData[i] = data[i];
                        }
                    }
                });
            }

            //setup ag-grid
            $scope.gridOptions = {
                enableSorting: true,
                enableFilter: true,
                rowData: [],
                data: [],
                enableColResize: true,
                headerHeight: 50,
                //filter changed event
                onAfterFilterChanged: function () {
                    user = Ref.child('users/' + currentAuth.uid);
                    var filter = filterConvert($rootScope.filterList, null);
                    //save filter
                    user.child('filter').set(filter, function (err) {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log('Saved filter');
                        }
                    });
                },
                onCellClicked: function (params) { }
            };

            /**
             * filter change event into angular $watch ($rootScope.filterList[i]...)
             */
            function filterChange(newVal, oldVal) {
                filterChangeFlag++;
                if (!filterOnOff) return;
                if (filterChangeFlag <= Object.keys($rootScope.filterList).length) return;
                for (var key in $rootScope.filterList) {
                    var filterItem = $rootScope.filterList[key];
                    var filterApi = $scope.gridOptions.api.getFilterApi(key);
                    if (filterItem.filter) {
                        var term = filterItem.filter.term;
                        if (term && term.length > 0) {
                            var model = [];
                            for (var i in term) {
                                model.push(term[i].value);
                            }
                            if (model.length > 0) {
                                filterApi.setModel(model);

                            } else {
                                filterApi.selectEverything();
                            }
                        } else {
                            filterApi.selectEverything();
                        }

                    } else if (filterItem.filters) {
                        var filterGreater = $scope.gridOptions.api.getFilterApi(key);
                        filterGreater.setType(filterGreater.GREATER_THAN);
                        filterGreater.setFilter(filterItem.filters[0].term);
                    }
                }
                $scope.gridOptions.api.onFilterChanged();
            }

            /*
             * convert columnDefs to filters and opposite
             */
            function filterConvert(rowDefs, filters) {
                if (filters) {
                    for (var i in rowDefs) {
                        if (rowDefs[i].filter) {
                            if (filter[i])
                                rowDefs[i].filter.term = filter[i];
                        }
                        if (rowDefs[i].filters) {
                            if (filter[i])
                                rowDefs[i].filters[0].term = filter[i];
                        }
                    }
                    return rowDefs;
                } else {
                    var filters = {};
                    for (var i in rowDefs) {
                        if (rowDefs[i].filter) {
                            if (rowDefs[i].filter.term)
                                filters[i] = rowDefs[i].filter.term;
                        }
                        if (rowDefs[i].filters) {
                            if (rowDefs[i].filters[0].term)
                                filters[i] = rowDefs[i].filters[0].term;
                        }
                    }
                    return filters;
                }
            }

            //Begin get data for ag-grid
            var bigNum = 1000000000;
            var titles = $firebaseObject(Ref.child('superstock_titles'));
            var fields = $firebaseObject(Ref.child('superstock_fields'));
            var format = $firebaseObject(Ref.child('superstock_format'));
            fields.$loaded(function () { //load superstock_fields
                titles.$loaded(function () { //load superstock_titles
                    format.$loaded(function () { //load superstock_format
                        var titlesArr = titles.data.split('|');
                        var fieldsArr = fields.data.split('|');
                        var formatArr = format.data.split('|');
                        var formatList = {};
                        // console.log(formatArr);
                        // console.log(titlesArr);
                        // console.log(fieldsArr);
                        //set up column size
                        var sizeArr = [
                            65, 250, 130, 100, 110, 120, 120, 130,
                            80, 150, 160, 150, 90, 140, 100, 120,
                            140, 120, 120, 120, 100, 90, 90, 140,
                            140, 140, 170, 80, 140, 110, 140, 100,
                            120, 120, 140, 120, 120, 120, 120, 100,
                            100, 140, 80, 140
                        ];
                        var columnDefs = [];
                        var config = {
                            idLabel: 'Mã',
                            labelList: []
                        }
                        for (var i in titlesArr) {
                            formatList[fieldsArr[i]] = formatArr[i];
                            config.labelList.push({
                                fieldName: fieldsArr[i],
                                format: formatArr[i]
                            });
                            var formatType = null;
                            var cellClass = null;
                            var filter = null;
                            if (formatArr[i].indexOf('bigNum') > -1 || formatArr[i].indexOf('number') > -1) {
                                formatType = 'number';
                                filter = 'number';
                            } else if (formatArr[i].indexOf('percent') > -1) {
                                filter = 'number';
                            }
                            //setup column data
                            var def = {
                                field: fieldsArr[i], //field name
                                width: sizeArr[i], //column width
                                headerName: titlesArr[i], //column title
                                cellClass: cellClass, //css class of cell in column
                                enableTooltip: true,
                                tooltipField: fieldsArr[i], //show tolltip
                                cellRenderer: function (params) { //cell render data
                                    if (params.colDef.field == 'symbol2') {
                                        /*
                                        * For "symbol2" column
                                        * - signal1 & signal2 is empty, show empty value
                                        */
                                        if (params.data.signal1 == '' && params.data.signal2 == '') {
                                            return '';
                                        }
                                    } else if (params.colDef.field == 'newPoint' || params.colDef.field == 'EPS'
                                        || params.colDef.field == 'fxEffect' || params.colDef.field == 'cashFlow') {
                                        /*
                                        * For "newPoint" and "EPS" column
                                        * - Show number with format which has 2 points
                                        */
                                        var value = '';
                                        if (isNaN(parseFloat(params.value))) {
                                            value = $filter('number')(0, 2);
                                        } else {
                                            value = $filter('number')(parseFloat(params.value), 2);
                                        }
                                        return '<div title="' + value + '">' + value + '</div>';
                                    }
                                    else {
                                        var value = '';
                                        if (formatList[params.colDef.field].indexOf('number') > -1 || formatList[params.colDef.field].indexOf('bigNum') > -1 || formatList[params.colDef.field].indexOf('percent') > -1) {
                                            value = $filter('number')(params.value);
                                            if (formatList[params.colDef.field].indexOf('percent') > -1) {
                                                if (isNaN(parseFloat(params.value))) {
                                                    value = '';
                                                } else {
                                                    value = $filter('number')(params.value, 2);
                                                    value = value + '%';
                                                }
                                            }
                                            return '<div title="' + value + '">' + value + '</div>';
                                        }
                                    }
                                    return params.value;
                                },
                                headerCellTemplate: function () {
                                    return (
                                        '<div class="ag-header-cell ag-header-cell-sortable ag-header-cell-sorted-none">' +
                                        '<table style="width:100%;height:100%">' +
                                        '<tr>' +
                                        '<td width="20px" style="vertical-align:top">' +
                                        '<span id="agMenu" class="ag-header-icon ag-header-cell-menu-button" style="opacity: 0; transition: opacity 0.2s, border 0.2s;">' +
                                        '<svg width="12" height="12"><rect y="0" width="12" height="2" class="ag-header-icon"></rect><rect y="5" width="12" height="2" class="ag-header-icon"></rect><rect y="10" width="12" height="2" class="ag-header-icon"></rect></svg>' +
                                        '</span>' +
                                        '</td>' +
                                        '<td>' +
                                        '<div id="agHeaderCellLabel" class="ag-header-cell-label">' +
                                        '<span id="agText" class="ag-header-cell-text"></span>' +
                                        '</div>' +
                                        '</td>' +
                                        '<td width="20px">' +
                                        '<div id="" class="ag-header-cell-label"><span id="agSortAsc" class="ag-header-icon ag-sort-ascending-icon ag-hidden"><svg width="10" height="10"><polygon points="0,10 5,0 10,10"></polygon></svg></span>    <span id="agSortDesc" class="ag-header-icon ag-sort-descending-icon ag-hidden"><svg width="10" height="10"><polygon points="0,0 5,10 10,0"></polygon></svg></span><span id="agNoSort" class="ag-header-icon ag-sort-none-icon ag-hidden"><svg width="10" height="10"><polygon points="0,4 5,0 10,4"></polygon><polygon points="0,6 5,10 10,6"></polygon></svg></span><span id="agFilter" class="ag-header-icon ag-filter-icon ag-hidden"><svg width="10" height="10"><polygon points="0,0 4,4 4,10 6,10 6,4 10,0" class="ag-header-icon"></polygon></svg></span></div>' +
                                        '</td>' +
                                        '</tr>' +
                                        '</table>' +
                                        '</div>'
                                    )
                                }
                            }
                            if (formatType) def.cellFilter = formatType; // add cell format (number or string)
                            if (filter) def.filter = filter; //add filter
                            if (formatArr[i] != '') { //add filter from A to B
                                var arr = formatArr[i].split(':');
                                if (arr.length === 4) {
                                    var filters = [{
                                        condition: 'GREATER_THAN',
                                        term: (arr[0] == 'bigNum') ? parseFloat(arr[2]) * bigNum : parseFloat(arr[2]),
                                        min: (arr[0] == 'bigNum') ? parseFloat(arr[1]) * bigNum : parseFloat(arr[1]),
                                        bigNum: (arr[0] == 'bigNum') ? true : false
                                    }, {
                                            condition: 'LESS_THAN',
                                            term: Infinity,
                                            max: (arr[0] == 'bigNum') ? parseFloat(arr[3]) * bigNum : parseFloat(arr[3])
                                        }];
                                    $rootScope.filterList[def.field] = {
                                        headerName: def.headerName,
                                        filters: filters
                                    }
                                }
                            }
                            if (fieldsArr[i] == 'symbol') { //cell template for 'symbol' column
                                def.filter = 'text';
                                def.pinned = 'left'; //pin column to left
                                def.cellRenderer = function (params) { // render 'symbol' cell template
                                    var id = params.value;
                                    return '<div><span>' + params.value + '</span>' +
                                        '<img class="chart-icon" data-symbol="' + id +
                                        '" data-industry = "' + params.node.data.industry + '" src="./images/icon-graph.png">' + '</div>';
                                }
                            }
                            //add filter for 'shorttermSignal' (filter selete option)
                            if (fieldsArr[i] == 'shorttermSignal') {
                                var filter = {
                                    term: null,
                                    selectOptions: [{
                                        value: 'xBán',
                                        label: 'Bán'
                                    }, {
                                            value: 'xMua nếu cơ bản tốt',
                                            label: 'Mua'
                                        }]
                                }
                                $rootScope.filterList[def.field] = {
                                    headerName: def.headerName,
                                    filter: filter
                                }
                            }
                            //add filter for 'industry' (filter selete option)
                            else if (fieldsArr[i] == 'industry') {
                                var filter = {
                                    term: null,
                                    selectOptions: [{
                                        value: 'Bao bì & đóng gói',
                                        label: 'Bao bì & đóng gói'
                                    }, {
                                            value: 'Nông sản và thủy hải sản',
                                            label: 'Nông sản và thủy hải sản'
                                        }, {
                                            value: 'Ngân hàng',
                                            label: 'Ngân hàng'
                                        }, {
                                            value: 'Thực phẩm',
                                            label: 'Thực phẩm'
                                        }],
                                    typeSearch: 'multiple'
                                }
                                $rootScope.filterList[def.field] = {
                                    headerName: def.headerName,
                                    filter: filter
                                }

                                def.minWidth = 200;
                            }

                            //add css class for cell base on cell date (utils factory)
                            def.cellClass = function (params) {
                                return utils.getCellClass(params, formatList);
                            }
                            columnDefs.push(def);
                        }
                        $rootScope.filters = columnDefs;
                        var $eventTimeout;
                        var $gridData = [];
                        try {
                            console.clear();
                        } catch (e) { }
                        draw.drawGrid(Ref.child('superstock'), config, function (data) {
                            //loading data
                        }, function (data) {
                            //loaded data
                            $scope.gridOptions.api.setColumnDefs(columnDefs);
                            $scope.gridOptions.columnApi.autoSizeColumns(fieldsArr);
                            for (var i in $rootScope.filterList) {
                                if ($rootScope.filterList[i].filters) {
                                    $rootScope.$watch('filterList["' + i + '"].filters[0].term', function (newVal, oldVal) {
                                        filterChange(newVal, oldVal);
                                    })
                                }
                                if ($rootScope.filterList[i].filter) {
                                    $rootScope.$watch('filterList["' + i + '"].filter.term', function (newVal, oldVal) {
                                        filterChange(newVal, oldVal);
                                    })
                                }
                            }

                            $rootScope.filterList = filterConvert($rootScope.filterList, filterData);
                            setTimeout(function () {
                                align();
                            }, 1000);
                        }, {
                                added: function (data, childSnapshot, id) {
                                    /*
                                    * Update data in grid when server update data
                                    */
                                    $gridData.push(data);
                                    if ($eventTimeout) {
                                        //
                                    } else {
                                        $eventTimeout = $timeout(function () {
                                            if ($scope.gridOptions.api && $scope.gridOptions.api != null)
                                                $scope.gridOptions.api.setRowData($gridData);
                                            $gridData = [];
                                            $eventTimeout = undefined;
                                        }, 1000);
                                    }
                                },
                                changed: function (data, childSnapshot, id) {
                                    /*
                                    * Data Changed Event
                                    */
                                },
                                removed: function (oldChildSnapshot) {
                                    /*
                                    * Data Removed Event
                                    */
                                }
                            })
                    })
                })
            });

            //convert bigNum term = term/bigNum
            $rootScope.parseBigNum = function (term) {
                var newTerm = parseFloat(term) / bigNum;
                return newTerm;
            }

            //show chart event
            $(document).on('click', '.chart-icon', function () {
                $('#myModal').modal('show');
                $scope.stockInfo = $(this).data('symbol') + ' - ' + $(this).data('industry');
                $scope.iSrc = 'https://banggia.vndirect.com.vn/chart/?symbol=' + $(this).data('symbol');
                $scope.iSrcTrust = $sce.trustAsResourceUrl($scope.iSrc);
            });

            //on/off filter
            $rootScope.onOffFilter = function (value) {
                filterOnOff = value;
                if (value) {
                    filterChange();
                } else {
                    $scope.gridOptions.api.setFilterModel(null);
                    $scope.gridOptions.api.onFilterChanged();

                }
            }

            //search base on 'symbol'
            $rootScope.search = function (searchTerm) {
                var filterApi = $scope.gridOptions.api.getFilterApi('symbol');
                filterApi.setType(filterApi.CONTAINS);
                filterApi.setFilter(searchTerm);
                $scope.gridOptions.api.onFilterChanged();
            }

            //set filter to default filter (Bộ lọc có sẵn)
            $rootScope.defaultFilter = function (filter) {
                if (filter) filter = filter[0];
                else {
                    for (var i in $rootScope.filterList) {
                        if ($rootScope.filterList[i].filter) {
                            $rootScope.filterList[i].filter.term = null;
                        }
                        if ($rootScope.filterList[i].filters) {
                            $rootScope.filterList[i].filters[0].term = $rootScope.filterList[i].filters[0].min;
                        }
                    }
                    $scope.gridOptions.api.onFilterChanged();
                    return;
                }
                $window.ga('send', 'event', "Filter", filter.filterName);
                for (var i in $rootScope.filterList) {
                    if ($rootScope.filterList[i].filter) {
                        $rootScope.filterList[i].filter.term = null;
                    }
                    if ($rootScope.filterList[i].filters) {
                        $rootScope.filterList[i].filters[0].term = $rootScope.filterList[i].filters[0].min;
                    }
                }
                for (var i in filter) {
                    if ($rootScope.filterList[i].filters) {
                        $rootScope.filterList[i].filters[0].term = filter[i];
                    }
                }
                $scope.gridOptions.api.onFilterChanged();
            }

            function align() {
                $('.ui-grid-header-cell').each(function () {
                    var thisTag = $(this);
                    var span = thisTag.find('span');
                    if (span.text().indexOf('\n') < 0) {
                        span.parent().css('line-height', '40px');
                        thisTag.css('text-align', 'center');
                    } else {
                        span.last().css('margin-top', '-2px');
                    }
                })
            }
            $(document).ready(function () {
                $(document).on('change', '.subTerm', function () {
                    $(this).each(function () {
                        var subTerm = $(this);
                        subTerm.prop('value', subTerm.val());
                        var field = subTerm.data('model');
                        $scope.$apply(function () {
                            $rootScope.filterList[field].filters[0].term = parseFloat(subTerm.val()) * bigNum;
                            subTerm.prop('value', subTerm.val());
                        });
                        subTerm.parent().next().children().slider({
                            slide: function (event, ui) {
                                subTerm.prop('value', ui.value / bigNum);
                            }
                        });
                    });
                });
                $(document).click(function (e) {
                    var container = $("#sidebar-wrapper");

                    if (!container.is(e.target) && container.has(e.target).length === 0) {
                        e.preventDefault();
                        e.stopPropagation();
                        if ($rootScope.link == 'main') return;
                        if ($("#wrapper").prop('class').indexOf('toggled') > -1) return;
                        $("#wrapper").toggleClass("toggled");
                    }
                });
            });
        }])
    .directive('ngEnter', function () {
        return function (scope, element, attrs) {
            element.bind("keydown keypress", function (event) {
                if (event.which === 13) {
                    scope.$apply(function () {
                        scope.$eval(attrs.ngEnter);
                    });

                    event.preventDefault();
                }
            });
        };
    });