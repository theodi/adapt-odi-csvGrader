import React, { useState } from 'react';

export default function csvGraderPopup(props) {
  const {
    handleSubmit,
    onCloseClick
  } = props;

  const [feedback, setFeedback] = useState(props._tutorFeedback || props._userFeedback || '');
  const [mark, setMark] = useState(props._tutorMark || props.score || '');

  const handleFeedbackChange = (event) => {
    setFeedback(event.target.value);
  };

  const handleMarkChange = (event) => {
    setMark(event.target.value);
  };

  return (
    <div className='csvgrader-popup__inner'>
      <button
        className="btn-icon csvgrader-popup__close"
        onClick={onCloseClick}
      ><span className="icon" aria-hidden="true" /></button>
      <h1>Tutor mark and feedback override</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="feedback">Feedback:</label>
          <textarea
            id="feedback"
            value={feedback}
            onChange={handleFeedbackChange}
            rows={20}
            cols={80}
          />
        </div>
        <div>
          <label htmlFor="mark">Mark:</label>
          <input
            type="number"
            id="mark"
            value={mark}
            onChange={handleMarkChange}
          />
        </div>
        <button
          className="btn-text"
        >Submit</button>
      </form>
    </div>

  );
}
