// https://github.com/codifytools/react-npm-package-boilerplate/blob/master/package.json

import PropTypes from "prop-types";
import React, { useState, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import FormGeneralError from "./components/FormGeneralError";
import { handleGravityFormsValidationErrors } from "./utils/manageErrors";
import { submissionHasOneFieldEntry } from "./utils/manageFormData";
import formatPayload from "./utils/formatPayload";
import { submitGravityForm } from "./fetch";
import { SettingsProvider } from "./providers/SettingsContext";
import FormBuilder from "./container/FormBuilder";

/**
 * Component to take Gravity Form graphQL data and turn into
 * a fully functional form.
 * @param {mixed} data Form dataset from graphQL
 */
const GravityFormForm = ({
  data,
  presetValues = null,
  successCallback = () => {},
  errorCallback = () => {},
  navigate,
  helperText = {},
}) => {
  const preOnSubmit = useRef();

  // Split out form data.
  const form = data?.gfForm;

  // Deconstruct global settings (if provided).
  const settings = data?.gfSettings || {};

  const {
    submitButton,
    confirmations,
    databaseId,
    descriptionPlacement,
    formFields,
    labelPlacement,
    subLabelPlacement,
    hasHoneypot,
  } = form;

  const redirect = navigate
    ? (url) => {
        navigate(url);
      }
    : (url) => {
        return (window.location.href = url);
      };

  // Pull in form functions
  const methods = useForm();
  const {
    handleSubmit,
    setError,
    reset,
    getValues,
    trigger,
    formState: { errors },
  } = methods;

  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  // add honeypot fake field if enabled to list of fields
  const formFieldNodes = formFields?.nodes?.length > 0 && [
    ...formFields.nodes,
    hasHoneypot && {
      id: formFields.nodes[formFields.nodes.length - 1].id + 1,
      type: "HONEYPOT",
      descriptionPlacement,
      labelPlacement,
      subLabelPlacement,
    },
  ];

  const onSubmitCallback = async () => {
    // Make sure we are not already waiting for a response
    if (!loading) {
      setLoading(true);
      // Clean error
      await preOnSubmit?.current?.recaptcha();
      const values = getValues();

      // Check that at least one field has been filled in
      if (submissionHasOneFieldEntry(values)) {
        setGeneralError("");
        const formRes = formatPayload({
          serverData: formFieldNodes,
          clientData: values,
        });

        try {
          const submitRes = await submitGravityForm({
            id: databaseId,
            fieldValues: formRes,
          });

          if (!Boolean(submitRes?.errors?.length)) {
            setSuccess(true);
            setLoading(false);
            successCallback({
              data: formRes,
              reset,
            });
          } else {
            setLoading(false);
            handleGravityFormsValidationErrors(submitRes?.errors, setError);
            errorCallback({
              data: formRes,
              error: handleGravityFormsValidationErrors(submitRes?.errors),
              reset,
            });
          }
        } catch (error) {
          console.log(error);
          setGeneralError("unknownError");
          setLoading(false);
          errorCallback({ data: formRes, error, reset });
        }
      } else {
        setLoading(false);
        setGeneralError("leastOneField");
      }
    }
  };

  if (success) {
    const confirmation = confirmations?.find((el) => {
      // First check if there is a custom confirmation
      // that is not the default.
      if (el.isActive && !el.isDefault) {
        return true;
      }

      // If not, revert back to the default one.
      if (el.isDefault) {
        return true;
      }
    });

    if (confirmation.type === "PAGE") {
      // TODO: Somehow need to get the page URL. Query currently
      // returns the page ID for the page redirect.
      redirect(confirmation?.url);
    }

    if (confirmation.type === "REDIRECT") {
      // TODO: Check that the redirect is internal.
      // If not, use window.location to direct to external URL.
      redirect(confirmation?.url);
    }

    if (confirmation.type === "MESSAGE") {
      return (
        <div className="gform_confirmation_wrapper">
          <div
            className="gform_confirmation_message"
            /* eslint-disable react/no-danger */
            dangerouslySetInnerHTML={{ __html: confirmation?.message }}
          />
        </div>
      );
    }
  }

  return (
    <div className="gform_wrapper" id={`gform_wrapper_${databaseId}`}>
      <div className="gform_anchor" id={`gf_${databaseId}`} />

      {formFields && (
        <SettingsProvider
          helperText={helperText}
          databaseId={databaseId}
          settings={settings}
          form={form}
          loading={loading}
        >
          <FormProvider {...methods}>
            <form
              className={
                loading
                  ? `gravityform gravityform--loading gravityform--id-${databaseId}`
                  : `gravityform gravityform--id-${databaseId}`
              }
              id={`gform_${databaseId}`}
              key={`gform_-${databaseId}`}
              onSubmit={handleSubmit(onSubmitCallback)}
              noValidate // needed to skip the built in form validation, as we use custom one
            >
              {generalError && <FormGeneralError errorCode={generalError} />}
              <FormBuilder
                nodes={formFieldNodes}
                preOnSubmit={preOnSubmit}
                presetValues={presetValues}
                trigger={trigger}
              />
            </form>
          </FormProvider>
        </SettingsProvider>
      )}
    </div>
  );
};

GravityFormForm.propTypes = {
  errorCallback: PropTypes.func,
  data: PropTypes.object.isRequired,
  successCallback: PropTypes.func,
  presetValues: PropTypes.shape({}),
  helperText: PropTypes.shape({}),
};

export default GravityFormForm;
