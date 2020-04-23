import { ITagoVariables, IVariable } from "./interfaces";

/**
 * Applies the Auto fill logic.
 *
 * When window.TagoIO.autoFill = true, you don't have to pass a `bucket` and `origin` key inside of your
 * objects in `sendData`. TagoIO will auto fill those fields automatically for you.
 *
 * If you want to set a specific bucket and device, you must set `window.TagoIO.autoFill` = false, and then pass
 * a `bucket` and `origin` key to the objects in the `sendData` function.
 *
 *
 * @param variables Variables to be sent
 * @param widgetVariables Widget variables loaded when starting
 * @return The autofill of the variables found
 */
function enableAutofill(variables: Array<IVariable>, widgetVariables: Array<ITagoVariables>): Array<IVariable> {
  const autoFillArray: Array<IVariable> = [];
  variables.map((userVar: IVariable) => {
    widgetVariables.map((widgetVar: ITagoVariables) => {
      if (userVar.variable == widgetVar.variable) {
        autoFillArray.push({
          bucket: widgetVar.origin.bucket || "",
          origin: widgetVar.origin.id || "",
          ...userVar,
        });
      }
    });
  });

  return autoFillArray;
}

export { enableAutofill };
