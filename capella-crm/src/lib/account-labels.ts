/** Descriptive account labels. Never use these values to authorize an operation. */
export function readAccountLabels(form:FormData):string[]{
 const labels=String(form.get('labels')??'').split(/[,;\n]+/).map(value=>value.trim().normalize('NFC')).filter(Boolean);
 if(labels.length>12||labels.some(value=>value.length>60||/[\u0000-\u001f\u007f]/.test(value)))throw new Error('12 étiquettes de 60 caractères maximum.');
 const seen=new Set<string>();
 return labels.filter(label=>{const key=label.toLocaleLowerCase('fr');if(seen.has(key))return false;seen.add(key);return true;});
}
