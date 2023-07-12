import Adapt from 'core/js/adapt';
import QuestionView from 'core/js/views/questionView';
class csvGraderView extends QuestionView {

  initialize(...args) {
    this.listenTo(Adapt, 'csvGrader:renderTable', this.renderTable);
    this.uploadFile = this.uploadFile.bind(this);
    super.initialize(...args);
  }

  preRender() {
    if (this.model.get('userAnswer')) {
      this.$('.js-csvGrader-textbox').val(this.model.get('userAnswer'));
      return true;
    }
    if (this.model.get('_userAnswer')) {
      this.$('.js-csvGrader-textbox').val(this.model.get('_userAnswer'));
    }
    this.listenTo(Adapt, 'questionView:triggerRecordInteraction', this.recordInteraction);
    return true;
  }

  onQuestionRendered() {
    if (this.model.get('userAnswer')) {
      this.renderTable();
    }
    this.setReadyStatus();
  }

  // This is important and should give the user feedback on how they answered the question
  // Normally done through ticks and crosses by adding classes
  showMarking() {
    super.showMarking();
  }

  // Used by the question view to reset the look and feel of the component.
  resetQuestion() {
    this.$('.js-csvGrader-textbox').prop('disabled', !this.model.get('_isEnabled')).val('');

    this.model.set({
      _isCorrect: undefined
    });
  }

  parseCSVData(csvData) {
    const lines = csvData.split('\n');
    const headers = lines[0].split(',');

    const tableHeaders = headers.map((header) => `<th contenteditable="true">${header}</th>`).join('');
    const tableHeaderRow = `<tr>${tableHeaders}</tr>`;

    const tableRows = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',');
      const tableColumns = cells.map((cell) => `<td contenteditable="true">${cell}</td>`).join('');
      tableRows.push(`<tr>${tableColumns}</tr>`);
    }

    return `<thead>${tableHeaderRow}</thead><tbody>${tableRows.join('')}</tbody>`;
  }

  renderTable() {
    let csvData = this.model.get('userData');
    const tableId = `${this.model.get('_id')}-table`;
    const table = this.$(`#${tableId}`)[0];
    this.model.set('table', table);
    if (this.model.get('userAnswer') && this.model.get('_isSubmitted')) {
      console.log('Got restore');
      csvData = this.model.get('userAnswer');
    }

    try {
      const tableContent = this.parseCSVData(csvData);
      table.innerHTML = tableContent;
    } catch (err) {
      console.log('Uploaded file is not valid CSV, could not parse' + err);
    }
  }

  uploadFile(event) {
    const file = event.target.files[0];
    event.target.value = null;
    const reader = new FileReader();
    const self = this;
    reader.onload = function (e) {
      try {
        const csvData = e.target.result;
        self.model.set('userData', csvData);
        self.renderTable();
      } catch (error) {
        console.error('Error parsing CSV file:', error);
      }
    };
    reader.readAsText(file);
  }

  // Only record the interaction once we have a score!
  recordInteraction() {
    if ((this.model.get('_recordInteraction') === true || !this.model.has('_recordInteraction')) && this.model.get('score')) {
      Adapt.trigger('questionView:recordInteraction', this);
    }
  }

  showCorrectAnswer() {
  }

  hideCorrectAnswer() {
  }

  onInputChanged(e) {
    const $input = $(e.target);
    this.model.setItemUserAnswer($input.parents('.js-csvGrader-item').index(), $input.val());
  }

}

csvGraderView.template = 'csvGrader.jsx';

export default csvGraderView;
