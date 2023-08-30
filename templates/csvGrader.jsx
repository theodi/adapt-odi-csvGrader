import React from 'react';
import { classes, templates } from 'core/js/reactHelpers';

export default function TextInput (props) {
  const {
    _isInteractionComplete,
    _id,
    _isEnabled,
    _isCorrect,
    displayTitle,
    body,
    instruction,
    ariaQuestion,
    uploadFile,
    downloadFile
  } = props;

  return (
    <div className="component__inner csvGrader__inner">

      <templates.header {...props} />

      {/* complex unless and if combination to set the correct classes for CSS to use in showing marking and disabled states */}
      <div
        className={classes([
          'component__widget csvGrader__widget',
          !_isEnabled && 'is-disabled',
          _isInteractionComplete && 'is-complete is-submitted show-user-answer',
          _isCorrect && 'is-correct'
        ])}
        aria-labelledby={ariaQuestion ? null : (displayTitle || body || instruction) && `${_id}-header`}
        aria-label={ariaQuestion || null}
      >
        <div id="table" className="table-editable">
          <span className="table-add glyphicon glyphicon-plus"></span>
          <table
            className="editableTable"
            id={`${_id}-table`}
          >
          </table>
        </div>

        <input
          type="file"
          className="csvGrader-button btn-text btn__action js-btn-action"
          id={`${_id}-userAnswerUpload`}
          accept=".csv"
          onChange={uploadFile}
        />
        <button
          className="csvGrader-button btn-text btn__action js-btn-action is-disabled"
          id={`${_id}-userAnswerDownload`}
          onClick={downloadFile}
        >Download submission</button>
      </div>
      <div className="btn__container" />
    </div>
  );
}
