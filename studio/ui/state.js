export class RevisionController {
 constructor(){this.sequence=0;this.pending=null;this.undoStack=[];this.redoStack=[];}
 invalidate(){this.sequence++;this.pending?.abort();this.pending=null;}
 start(){this.invalidate();this.pending=new AbortController();return {sequence:this.sequence,signal:this.pending.signal};}
 current(seq){return seq===this.sequence;}
 change(before){this.invalidate();this.undoStack.push(structuredClone(before));if(this.undoStack.length>80)this.undoStack.shift();this.redoStack=[];}
 move(current,redo){const from=redo?this.redoStack:this.undoStack,to=redo?this.undoStack:this.redoStack;if(!from.length)return null;this.invalidate();to.push(structuredClone(current));return from.pop();}
}
