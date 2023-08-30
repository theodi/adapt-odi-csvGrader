import Adapt from 'core/js/adapt';
import React from 'react';
import ReactDOM from 'react-dom';
import { templates } from 'core/js/reactHelpers';

class csvGraderPopupView extends Backbone.View {

  className() {
    return 'csvgrader-popup';
  }

  initialize() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.listenTo(Adapt, 'notify:opened', this.onNotifyOpened);

    this.model.set('onCloseClick', this.onCloseClick.bind(this));

    // Debounce required as a second (bad) click event is dispatched on iOS causing a jump of two items.
    // this.handleSubmit = _.debounce(this.handleSubmit.bind(this), 100);
    this.model.set('handleSubmit', this.handleSubmit.bind(this));
  }

  onNotifyOpened() {
    this.render();
  }

  onCloseClick() {
    Adapt.trigger('notify:close');
  }

  render() {
    ReactDOM.render(<templates.csvGraderPopup {...this.model.toJSON()} />, this.el);
  }

  handleSubmit(event) {
    event.preventDefault();
    console.log('handle submit');
    const submittedFeedback = event.target.elements.feedback.value;
    const submittedMark = parseInt(event.target.elements.mark.value);
    this.model.set('_tutorMark', submittedMark);
    this.model.set('_tutorFeedback', submittedFeedback);
    Adapt.trigger('notify:close');
  }

};

export default csvGraderPopupView;
