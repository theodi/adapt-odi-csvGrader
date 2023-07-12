import components from 'core/js/components';
import csvGraderView from './csvGraderView';
import csvGraderModel from './csvGraderModel';

export default components.register('csvGrader', {
  view: csvGraderView,
  model: csvGraderModel
});
