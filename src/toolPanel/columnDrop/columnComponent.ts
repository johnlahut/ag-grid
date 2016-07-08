import {
    PopupService,
    Utils,
    Component,
    Autowired,
    ColumnController,
    Context,
    DragAndDropService,
    GridPanel,
    GridOptionsWrapper,
    DropTarget,
    PostConstruct,
    QuerySelector,
    Column,
    DragSource
} from "ag-grid/main";
import {VirtualList} from "../../rendering/virtualList";
import {AggFuncService} from "../../aggregation/aggFuncService";

export class ColumnComponent extends Component {

    public static EVENT_COLUMN_REMOVE = 'columnRemove';

    private static TEMPLATE =
       `<span class="ag-column-drop-cell">
          <span class="ag-column-drop-cell-text"></span>
          <span class="ag-column-drop-cell-button">&#10006;</span>
        </span>`;

    @Autowired('dragAndDropService') dragAndDropService: DragAndDropService;
    @Autowired('columnController') columnController: ColumnController;
    @Autowired('gridPanel') gridPanel: GridPanel;
    @Autowired('context') context: Context;
    @Autowired('popupService') popupService: PopupService;
    @Autowired('aggFuncService') aggFuncService: AggFuncService;
    @Autowired('gridOptionsWrapper') gridOptionsWrapper: GridOptionsWrapper;

    @QuerySelector('.ag-column-drop-cell-text') private eText: HTMLElement;
    @QuerySelector('.ag-column-drop-cell-button') private btRemove: HTMLElement;

    private column: Column;
    private dragSourceDropTarget: DropTarget;
    private ghost: boolean;
    private displayName: string;
    private valueColumn: boolean;

    private popupShowing = false;

    constructor(column: Column, dragSourceDropTarget: DropTarget, ghost: boolean, valueColumn: boolean) {
        super(ColumnComponent.TEMPLATE);
        this.valueColumn = valueColumn;
        this.column = column;
        this.dragSourceDropTarget = dragSourceDropTarget;
        this.ghost = ghost;
    }

    @PostConstruct
    public init(): void {
        this.displayName = this.columnController.getDisplayNameForCol(this.column);
        this.setupComponents();
        if (!this.ghost && !this.gridOptionsWrapper.isFunctionsReadOnly()) {
            this.addDragSource();
        }
    }

    private addDragSource(): void {
        var dragSource: DragSource = {
            eElement: this.getGui(),
            dragItem: [this.column],
            dragItemName: this.displayName,
            dragSourceDropTarget: this.dragSourceDropTarget
        };
        this.dragAndDropService.addDragSource(dragSource);
    }

    private setupComponents(): void {

        this.setTextValue();
        this.addDestroyableEventListener(this.btRemove, 'click', (event: MouseEvent)=> {
            this.dispatchEvent(ColumnComponent.EVENT_COLUMN_REMOVE);
            event.stopPropagation();
        });

        Utils.setVisible(this.btRemove, !this.gridOptionsWrapper.isFunctionsReadOnly());

        if (this.ghost) {
            Utils.addCssClass(this.getGui(), 'ag-column-drop-cell-ghost');
        }

        if (this.valueColumn && !this.gridOptionsWrapper.isFunctionsReadOnly()) {
            this.addGuiEventListener('click', this.onShowAggFuncSelection.bind(this) );
        }
    }

    private setTextValue(): void {
        var displayValue: string;

        if (this.valueColumn) {
            var aggFunc = this.column.getAggFunc();
            // if aggFunc is a string, we can use it, but if it's a function, then we swap with 'func'
            var aggFuncString = (typeof aggFunc === 'string') ? <string> aggFunc : 'agg';

            displayValue = `${aggFuncString}(${this.displayName})`;
        } else {
            displayValue = this.displayName;
        }

        this.eText.innerHTML = displayValue;
    }

    private onShowAggFuncSelection(): void {

        if (this.popupShowing) { return; }

        this.popupShowing = true;

        var virtualList = new VirtualList();

        var rows = this.aggFuncService.getFuncNames();

        virtualList.setModel({
            getRow: function(index: number) { return rows[index]; },
            getRowCount: function() { return rows.length; }
        });

        this.context.wireBean(virtualList);

        var ePopup = Utils.loadTemplate('<div class="ag-select-agg-func-popup"></div>');
        ePopup.style.top = '0px';
        ePopup.style.left = '0px';
        ePopup.appendChild(virtualList.getGui());
        ePopup.style.height = '100px';
        ePopup.style.width = this.getGui().clientWidth + 'px';

        var popupHiddenFunc = () => {
            virtualList.destroy();
            this.popupShowing = false;
        };

        var hidePopup = this.popupService.addAsModalPopup(
            ePopup,
            true,
            popupHiddenFunc
        );

        virtualList.setComponentCreator(this.createAggSelect.bind(this, hidePopup));

        this.popupService.positionPopupUnderComponent({
            eventSource: this.getGui(),
            ePopup: ePopup,
            keepWithinBounds: true
        });

        virtualList.refresh();
    }

    private createAggSelect(hidePopup: ()=>void, value: any): Component {

        var itemSelected = ()=> {
            hidePopup();
            this.columnController.setColumnAggFunc(this.column, value);
        };

        var comp = new AggItemComp(itemSelected, value.toString());
        return comp;
    }
}

class AggItemComp extends Component {

    private value: string;

    constructor(itemSelected: ()=>void, value: string) {
        super('<div class="ag-select-agg-func-item"/>');
        this.getGui().innerText = value;
        this.value = value;
        this.addGuiEventListener('click', itemSelected);
    }

}