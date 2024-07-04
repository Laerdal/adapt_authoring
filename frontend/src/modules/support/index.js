define(function (require) {
    let Origin = require('core/origin');

    Origin.on('navigation:support', function () {
        let override = Origin.constants.supportLink;
        if (override) {
            window.open(override);
        } else {
            openSupportLink();
        }
    });

    function openSupportLink() {
        let SUPPORT_URL = 'https://laerdal.atlassian.net/jira/servicedesk/projects/AS/queues/custom/10';
        window.open(SUPPORT_URL);
    }
});
