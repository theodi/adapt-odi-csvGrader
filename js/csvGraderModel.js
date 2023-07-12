import Adapt from 'core/js/adapt';
import QuestionModel from 'core/js/models/questionModel';
import Ajv from 'libraries/ajv.min';

class csvGraderModel extends QuestionModel {

  // Extend from the ComponentModel trackable - Doesn't work for SCORM

  trackable() {
    try {
      if (Adapt.spoor) {
        if (Adapt.spoor.config._isEnabled) {
          return QuestionModel.resultExtend('trackable', []);
        }
      }
    } catch (err) { console.log(err); }
    return QuestionModel.resultExtend('trackable', [
      '_userFeedback',
      '_userFeedbackRating'
    ]);
  }

  trackableType() {
    try {
      if (Adapt.spoor) {
        if (Adapt.spoor.config._isEnabled) {
          return QuestionModel.resultExtend('trackableType', []);
        }
      }
    } catch (err) { console.log(err); }
    return QuestionModel.resultExtend('trackableType', [
      Array,
      Number
    ]);
  }

  initialize(...args) {
    this.listenTo(Adapt, 'tutor:opened', this.onTutorOpened);
    this.listenTo(Adapt, 'tutor:closed', this.onTutorClosed);
    this.createAIConversation();
    super.initialize(...args);
    this.set('_shouldShowMarking', false);
    this.set('_canShowMarking', false);
  }

  reset(type = 'hard', canReset = this.get('_canReset')) {
    super.reset(type, canReset);
    this.set('_score', undefined);
    this.set('score', undefined);
    this.set('userFeedback', undefined);
    this.set('_userFeedback', undefined);
    this.set('_shouldShowMarking', false);
    this.set('_canShowMarking', false);
    this.set('_userFeedbackRendered', false);
  }

  canSubmit() {
    return true;
  }

  isCorrect() {
    // Not yet marked (still waiting for the score)

    if (!this.get('_score')) {
      return undefined;
    }

    let isCorrect = false;

    if (this.get('_score') >= this.get('passScore')) {
      isCorrect = true;
    } else {
      isCorrect = false;
    }

    try {
      if (Adapt.spoor) {
        if (Adapt.spoor.config._isEnabled) {
          this.set('_userAnswer', isCorrect);
        }
      }
    } catch (error) {}

    this.set('_isCorrect', isCorrect);

    return isCorrect;
  }

  get score() {
    if (this.get('_score')) {
      return this.get('_score');
    } else {
      return 0;
    }
  }

  readUserAnswerAsCSV() {
    const table = this.get('table');
    // Get all table rows
    const headers = Array.from(table.querySelectorAll('th')).map(header => header.textContent.trim());
    const dataRows = Array.from(table.querySelectorAll('tbody tr'));

    const data = dataRows.map(row => {
      const cells = Array.from(row.cells).map(cell => cell.textContent.trim());
      return cells.join(',');
    });

    const csvContent = [headers.join(','), ...data].join('\n');
    return csvContent;
  }

  readUserAnswerAsJSON() {
    const table = this.get('table');
    const placeholderText = 'click to edit';
    const data = [];
    const rows = table.rows;

    // Iterate over rows (skipping the header row)

    for (let i = 1; i < rows.length; i++) {

      const rowData = {};

      const cells = rows[i].cells;

      let hasValues = false; // Flag to track if the row has any non-empty cells

      // Iterate over cells
      for (let j = 0; j < cells.length; j++) {
        const cell = cells[j];
        const value = cell.innerHTML.trim() || '';

        // Skip cells with placeholder text
        if (value !== placeholderText) {
          let columnName = 'col' + j;
          try {
            columnName = table.rows[0].cells[j].innerHTML.trim();
          } catch (err) {
          }

          // Check for different data types
          if (value === 'true' || value === 'false') {
            rowData[columnName] = value === 'true';
          } else if (/^-?\d+(\.\d+)?$/.test(value)) {
            rowData[columnName] = parseFloat(value);
          } else {
            rowData[columnName] = value;
          }

          hasValues = true; // Set flag to true if a non-empty cell is found
        }
      }

      // Add row data to the array if it has at least one non-empty cell
      if (hasValues) {
        data.push(rowData);
      }
    }
    return data;
  }

  // Overriding deprecated method, just in case something calls it!
  setScore() {
  }

  markQuestion() {
    this.set('_canShowFeedback', true);
    const csvData = this.readUserAnswerAsCSV();
    this.set('_userAnswer', csvData);
    this.set('userAnswer', csvData);
    if (this.userAnswerValidates()) {
      this.set('score', this.get('maxScore'));
      this.set('_score', this.get('maxScore'));
      this.isCorrect();
      const bands = this.get('_feedback')._bands;
      const closest = 100;
      let band = null;
      for (let i = 0; i < bands.length; i++) {
        const diff = bands[i]._score - this.get('_score');
        if ((this.get('_score') >= bands[i]._score) && (diff < closest)) {
          band = i;
        }
      }
      this.set('_userFeedback', bands[band].feedback);
      this.set('_shouldShowMarking', true);
      this.set('_canShowMarking', true);
      this.set('_userFeedbackRendered', true);
      return true;
    }
    const conversation = this.get('conversation');
    let question = this.get('chatTemplate');
    question = question.replace('{{userAnswer}}', '\n\n' + csvData + '\n\n');
    try {
      if (Adapt.spoor) {
        if (Adapt.spoor.config._isEnabled) {
          this.set('userAnswer', csvData);
          this.set('_userAnswer', false);
          this.setCookie('_userAnswer', csvData);
        }
      }
    } catch (error) {}
    conversation.push({ role: 'user', content: question });
    this.set('conversation', conversation);
    this.chatWithGPT(800);
  }

  userAnswerValidates() {
    const ajv = new Ajv(); // Create a new instance of Ajv
    const schema = this.get('schemaData');
    schema.$schema = 'http://json-schema.org/schema#';
    const validate = ajv.compile(schema); // Compile the cached schema

    const isValid = validate(this.readUserAnswerAsJSON()); // Validate the data against the schema

    if (isValid) {
      return true;
    } else {
      this.set('validationErrors', validate.errors);
      return false;
    }
  }

  restoreUserAnswers() {
    if (!this.get('_isSubmitted')) return;

    this.setQuestionAsSubmitted();
    this.set('_shouldShowMarking', true);
    this.set('_canShowMarking', true);
    this.set('_userFeedbackRendered', true);
    try {
      if (Adapt.spoor) {
        if (Adapt.spoor.config._isEnabled) {
          this.set('_userAnswer', this.isCorrect());
          const data = JSON.parse(this.getCookie('csvGrader-' + this.get('_id')));
          if (data._userAnswer) { this.set('userAnswer', data._userAnswer); }
          if (data._userFeedback) { this.set('_userFeedback', data._userFeeback); }
          this.set('score', this.get('_score'));
          this.set('_userFeedback', data._userFeedback);
        }
      }
    } catch (err) {
      const bands = this.get('_feedback')._bands;
      const closest = 100;
      let band = null;
      for (let i = 0; i < bands.length; i++) {
        const diff = bands[i]._score - this.get('_score');
        if ((this.get('_score') >= bands[i]._score) && (diff < closest)) {
          band = i;
        }
      }
      this.set('_userFeedback', bands[band].feedback);
    }
    // this.markQuestion();
    // this.setScore();
    this.updateRawScore();
    this.setupFeedback();
  }
  /* All of this is generic to ChatGPT feedback */

  onTutorClosed(tutor) {
    if (tutor.model.get('_id') !== this.get('_id')) {
      return;
    }
    this.clearTimer();
  }

  onTutorOpened(tutor) {
    if (tutor.model.get('_id') !== this.get('_id')) {
      return;
    }
    const tutorElement = document.querySelector('.notify__content-inner');
    // Create the elements
    const tutorAutoDiv = document.createElement('div');
    tutorAutoDiv.className = 'tutor__auto';
    const tutorAutoInnerDiv = document.createElement('div');
    tutorAutoInnerDiv.className = 'tutor__auto-inner';
    // Append the inner div to the auto div
    tutorAutoDiv.appendChild(tutorAutoInnerDiv);

    tutorAutoInnerDiv.innerHTML = 'Waiting for auto tutor response';
    tutorElement.appendChild(tutorAutoDiv);
    if (!this.get('_score')) {
      const button = document.querySelector('.notify__close-btn');
      button.style.display = 'none';
      button.parentNode.innerHTML += `
        <div class="base-timer">
          <svg class="base-timer__svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <g class="base-timer__circle">
              <circle class="base-timer__path-elapsed" cx="50" cy="50" r="45"></circle>
               <path
          id="base-timer-path-remaining"
          stroke-dasharray="283"
          class="base-timer__path-remaining white"
          d="
            M 50, 50
            m -45, 0
            a 45,45 0 1,0 90,0
            a 45,45 0 1,0 -90,0
          "
        ></path>
            </g>
          </svg>
          <span id="base-timer-label" class="base-timer__label">
          </span>
        </div>
        `;
      this.startTimer(20);
    }

    this.checkUserFeedback();

  }

  checkUserFeedback() {
    let userFeedback = this.get('_userFeedback');
    if (userFeedback) {
      const paragraphs = userFeedback.split('\n').map(function(line) {
        return '<p>' + line + '</p>';
      });
      userFeedback = paragraphs.join('');
      this.set('_userFeedback', userFeedback);
      try {
        if (Adapt.spoor) {
          if (Adapt.spoor.config._isEnabled) {
            this.setCookie('_userFeedback', userFeedback);
          }
        }
      } catch (err) {}
      if (this.get('_userFeedbackRendered')) {
        this.renderFeedback();
      } else {
        this.populateUserFeedback();
      }
    } else {
      setTimeout(() => this.checkUserFeedback(), 100); // Retry after 100 milliseconds
    }
  }

  renderFeedback() {
    const tutorAutoInnerDiv = document.querySelector('.tutor__auto-inner');
    // tutorAutoInnerDiv.innerHTML = "Auto-tutor response<br/><br/>";
    tutorAutoInnerDiv.innerHTML = this.get('_userFeedback');
    const marking = '<p>Score: ' + this.get('score') + '/' + this.get('maxScore') + '</p>';
    tutorAutoInnerDiv.innerHTML += marking;
    Adapt.trigger('notify:resize');
  }

  populateUserFeedback() {
    this.set('_canShowFeedback', true);
    this.set('_userFeedbackRendered', true);

    const tutorAutoInnerDiv = document.querySelector('.tutor__auto-inner');
    tutorAutoInnerDiv.innerHTML = '';
    let currentIndex = 0;

    const self = this;

    const appendWord = () => {
      const words = self.get('_userFeedback').split(' ');
      const totalWords = words.length;
      if (currentIndex < totalWords) {
        const word = words[currentIndex];
        let currentString = tutorAutoInnerDiv.innerHTML;
        currentString += ' ' + word;
        tutorAutoInnerDiv.innerHTML = currentString;
        currentIndex++;
        Adapt.trigger('notify:resize');
        // Add a delay between words (adjust the duration as needed)
        setTimeout(appendWord, 50);
      } else {
        self.set('userFeedbackRenderComplete', true);
        if (self.get('_score')) {
          const marking = '<p>Score: ' + self.get('_score') + '/' + self.get('maxScore') + '</p>';
          tutorAutoInnerDiv.innerHTML += marking;
        }
      }
    };
    appendWord();
  }

  createAIConversation() {
    let conversation = [
      { role: 'system', content: this.get('systemAI') }
    ];
    this.set('conversation', conversation);
    // Get file containing sample to populate table
    const schemaFile = this.get('schema');
    // If we have a sample file and there is no userData to load
    if (schemaFile && (!this.get('schemaData'))) {
      fetch(schemaFile)
        .then(response => response.text())
        .then(text => {
          this.set('schemaData', JSON.parse(text));
          conversation = this.get('conversation');
          conversation.push({ role: 'assistant', content: 'This is an example JSON schema file that could be used to validate the data: \n\n' + text });
          this.set('conversation', conversation);
        })
        .catch(error => {
          console.error('Error loading schema:', error);
        });
    }
    const modelAnswerFile = this.get('modelAnswer');
    if (modelAnswerFile) {
      fetch(modelAnswerFile)
        .then(response => response.text())
        .then(text => {
          this.set('modelAnswerData', text);
          conversation = this.get('conversation');
          conversation.push({ role: 'assistant', content: 'This model answer is: \n\n' + text });
          this.set('conversation', conversation);
          // this.renderModelAnswerTable();
        })
        .catch(error => {
          console.error('Error loading model answer:', error);
        });
    }
  }

  chatWithGPT(tokens) {
    const apiKey = this.get('aiAPIKey');
    let conversation = this.get('conversation');

    // Testing
    /*
    const self = this;
    setTimeout(function() {
      const reply = '3) Testing feedback,\n\n this not real \n\n All over the place? \n Boo';
      self.set('_userFeedback', ' ' + reply);
    }, 2000);
    setTimeout(function() {
      const reply = self.extractLowestNumberFromString("I'll give it 3 out of 10.", self.get('maxScore'));
      self.clearTimer();
      self.set('score', reply);
      self.set('_score', reply);
      self.set('_shouldShowMarking', true);
      self.set('_canShowMarking', true);
      self.isCorrect();
      Adapt.trigger('questionView:triggerRecordInteraction');
      self.checkQuestionCompletion();
      if (self.get('userFeedbackRenderComplete')) {
        self.renderFeedback();
      }
      self.updateButtons();
    }, 4000);
    return;
    */
    // Actual code here

    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: conversation,
        max_tokens: tokens,
        temperature: 0.7,
        n: 1,
        stop: null
      })
    })
      .then(response => {
        if (response.status === 429) {
          this.startTimer(40);
          const self = this;
          setTimeout(function() {
            self.chatWithGPT(tokens);
          }, 20000);
        } else {
          return response.json();
        }
      })
      .then(data => {
        const assistantReply = data.choices[0].message.content;
        if (this.get('getScore')) {
          const score = this.extractLowestNumberFromString(assistantReply, this.get('maxScore'));
          if (score) {
            this.clearTimer();
            this.set('chatGPTScore', score);
            this.set('_score', score);
            this.set('score', score);
            this.set('_shouldShowMarking', true);
            this.set('_canShowMarking', true);
            this.isCorrect();
            Adapt.trigger('questionView:triggerRecordInteraction');
            this.checkQuestionCompletion();
            if (this.get('userFeedbackRenderComplete')) {
              this.renderFeedback();
            }
            this.updateButtons();
          } else {
            this.createAIConversation();
            conversation = this.get('conversation');
            let question = 'This is the users answer: \n\n' + this.get('userAnswer') + '\n\n';
            question += 'Give the user a mark out of ' + this.get('maxScore') + ' for their answer, just return a number and nothing else.';
            conversation.push({ role: 'user', content: question });
            this.chatWithGPT(100);
          }
        } else {
          this.set('_userFeedback', ' ' + assistantReply);
        }
        if (!this.get('chatGPTScore') && !this.get('getScore')) {
          this.set('getScore', true);
          const question = 'Give the user a mark out of ' + this.get('maxScore') + ' for their answer, just return a number and nothing else.';
          conversation.push({ role: 'user', content: question });
          conversation.push({ role: 'assistant', content: assistantReply });
          this.chatWithGPT(100);
        }
      })
      .catch(error => {
        console.log(error.message);
      });
  }

  extractLowestNumberFromString(inputString, maxScore) {
    const numberRegex = /\d+/g; // Regular expression to match one or more digits globally
    const numbers = inputString.match(numberRegex); // Find all matches of numbers in the string

    if (numbers) {
      const parsedNumbers = numbers.map(Number); // Convert matched numbers to an array of integers
      const numCount = parsedNumbers.length; // Count the number of numbers in the string

      if (numCount === 1 && parsedNumbers[0] === maxScore) {
        return null; // Return null if there is only one number and it matches maxScore
      }

      const lowestNumber = Math.min(...parsedNumbers); // Find the lowest number using Math.min()
      return lowestNumber;
    }

    return null; // Return null if no number is found in the string
  }

  get maxScore() {
    return this.get('maxScore');
  }

  /* END GENERIC */

  /**
  * used by adapt-contrib-spoor to get the user's answers in the format required by the cmi.interactions.n.student_response data field
  * returns the user's answers as a string in the format 'answer1[,]answer2[,]answer3'
  * the use of [,] as an answer delimiter is from the SCORM 2004 specification for the fill-in interaction type
  */

  // Checks if the question should be set to complete
  // Calls setCompletionStatus and adds complete classes
  checkQuestionCompletion() {

    if (typeof this.get('_isCorrect') === 'undefined') {
      return false;
    }

    const isComplete = (this.get('_isCorrect') || this.get('_attemptsLeft') === 0);

    if (isComplete) {
      this.setCompletionStatus();
    }

    return isComplete;

  }

  getResponse() {
    const object = {};
    object._userAnswer = this.get('userAnswer');
    object._userFeedback = this.get('_userFeedback');
    return JSON.stringify(object);
  }

  /**
  * used by adapt-contrib-spoor to get the type of this question in the format required by the cmi.interactions.n.type data field
  */
  getResponseType() {
    return 'fill-in';
  }

  setCookie(key, value) {
    const id = this.get('_id');
    let object = JSON.parse(this.getCookie('csvGrader-' + id)) || {};
    object[key] = value;
    object = JSON.stringify(object);
    document.cookie = 'csvGrader-' + id + '=' + encodeURIComponent(object) + '; expires=Fri, 31 Dec 2032 23:59:59 GMT; path=/';
  }

  getCookie(name) {
    const cookies = document.cookie.split('; ');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].split('=');
      if (cookie[0] === name) {
        return decodeURIComponent(cookie[1]);
      }
    }
    return null;
  }

  /* Timers for AI Content */

  startTimer(limit) {
    document.querySelector('.notify__close-btn').style.display = 'none';
    document.querySelector('.base-timer').style.display = 'inline-block';
    let timerInterval = this.get('timerInterval');
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    let timePassed = 0;
    timerInterval = setInterval(() => {
      document.querySelector('.notify__close-btn').style.display = 'none';

      // The amount of time passed increments by one
      timePassed = timePassed += 1;
      const timeLeft = limit - timePassed;
      if (timeLeft < 1) {
        document.getElementById('base-timer-label').innerHTML = timeLeft;
        document.querySelector('.notify__close-btn').style.display = 'inline-block';
        document.querySelector('.base-timer').style.display = 'none';
        try {
          clearInterval(timerInterval);
        } catch (err) {}
      }

      // The time left label is updated
      document.getElementById('base-timer-label').innerHTML = timeLeft;
      this.setCircleDasharray(limit, timeLeft);
    }, 1000);
    this.set('timerInterval', timerInterval);
  }

  clearTimer() {
    try {
      const timerInterval = this.get('timerInterval');
      document.querySelector('.notify__close-btn').style.display = 'inline-block';
      document.querySelector('.base-timer').style.display = 'none';
      clearInterval(timerInterval);
    } catch (err) {}
  }

  calculateTimeFraction(limit, timeLeft) {
    const rawTimeFraction = timeLeft / limit;
    return rawTimeFraction - (1 / limit) * (1 - rawTimeFraction);
  }

  setCircleDasharray(limit, timeLeft) {
    const FULL_DASH_ARRAY = 283;
    const circleDasharray = `${(
      this.calculateTimeFraction(limit, timeLeft) * FULL_DASH_ARRAY
    ).toFixed(0)} 283`;
    document
      .getElementById('base-timer-path-remaining')
      .setAttribute('stroke-dasharray', circleDasharray);
  }

}

csvGraderModel.genericAnswerIndexOffset = 65536;

export default csvGraderModel;
