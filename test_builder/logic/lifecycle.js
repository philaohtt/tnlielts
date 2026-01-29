export const deepFreeze = (obj) => {
    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach(prop => {
        if (obj.hasOwnProperty(prop) && obj[prop] !== null && (typeof obj[prop] === "object") && !Object.isFrozen(obj[prop])) {
            deepFreeze(obj[prop]);
        }
    });
    return obj;
};

export const publishSnapshot = (draft) => deepFreeze(JSON.parse(JSON.stringify(draft)));