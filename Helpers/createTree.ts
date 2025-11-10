let count=0;
const createTree=(arr:any,ParentID="")=>{
    const Tree=[];
    arr.forEach((item) => {
        if(item.parent_id === ParentID){
            count++;
            const newItem=item;
            newItem.index=count;
            const children = createTree(arr,item.id);
            if(children.length>0){
                newItem.children=children;
            }
            Tree.push(newItem);
        }
    });
    return Tree;
}
module.exports.Tree=(arr:any,ParentID="")=>{
    count=0;
    const Tree=createTree(arr,ParentID="");
    return Tree;
}