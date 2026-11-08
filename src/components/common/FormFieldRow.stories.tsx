import { FormFieldRow } from "./FormFieldRow";

export const Default = () => (
  <div className="max-w-2xl rounded-box border border-base-300 bg-base-100">
    <FormFieldRow controlId="catalog-field" label="Example field">
      <input
        aria-label="Example field"
        className="input input-bordered input-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
        defaultValue="Value"
        id="catalog-field"
      />
    </FormFieldRow>
  </div>
);
