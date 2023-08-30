import Adapt from 'core/js/adapt';
import QuestionView from 'core/js/views/questionView';
import notify from 'core/js/notify';
import CSVGraderPopupView from './csvGraderPopupView';

class csvGraderView extends QuestionView {

  initialize(...args) {
    this.listenTo(Adapt, 'csvGrader:renderTable', this.renderTable);
    this.uploadFile = this.uploadFile.bind(this);
    this.downloadFile = this.downloadFile.bind(this);
    super.initialize(...args);
    const self = this;
    document.addEventListener('keydown', function(event) {
      if (event.ctrlKey && event.key === '%') {
        const enteredPassword = prompt('Enter tutor password:');
        const expectedPassword = self.model.get('tutorPassword');

        if (enteredPassword === expectedPassword) {
          self.openTutorPopup();
        } else {
          alert('Incorrect password. Access denied.');
        }
      }
    });
  }

  openTutorPopup() {
    if (this._isPopupOpen) return;

    this._isPopupOpen = true;

    this.popupView = new CSVGraderPopupView({
      model: this.model
    });

    notify.popup({
      _attributes: { 'data-adapt-id': this.model.get('_id') },
      _view: this.popupView,
      _isCancellable: true,
      _showCloseButton: false,
      _classes: 'csvGrader is-component is-csvGrader ' + this.model.get('_classes')
    });

    this.listenToOnce(Adapt, {
      'popup:closed': this.onPopupClosed
    });
  }

  onPopupClosed() {
    this._isPopupOpen = false;
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
    const downloadButtonId = `${this.model.get('_id')}-userAnswerDownload`;
    this.model.set('table', table);
    if (this.model.get('userAnswer') && this.model.get('_isSubmitted')) {
      csvData = this.model.get('userAnswer');
    }

    try {
      const tableContent = this.parseCSVData(csvData);
      table.innerHTML = tableContent;
      this.$(`#${downloadButtonId}`)
        .removeClass('is-disabled');
      ;
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

  downloadFile() {
    if (!this.model.get('_isSubmitted')) return;
    const csvData = this.model.readUserAnswerAsCSV();
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'datafile.csv';
    a.click();

    // Clean up by revoking the object URL
    URL.revokeObjectURL(url);
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
