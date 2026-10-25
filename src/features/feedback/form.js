const {
    ModalBuilder,
    LabelBuilder,
    TextInputBuilder,
    TextInputStyle,
    RadioGroupBuilder,
    FileUploadBuilder,
    CheckboxBuilder,
} = require('discord.js');

const MODAL_ID = 'puro:feedback:submit';
const MAX_SUBJECT = 100;
const MAX_MESSAGE = 1000;

function feedbackForm() {
    return new ModalBuilder()
        .setCustomId(MODAL_ID)
        .setTitle('Send feedback')
        .addLabelComponents(
            new LabelBuilder()
                .setLabel('Subject')
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId('subject')
                        .setStyle(TextInputStyle.Short)
                        .setMaxLength(MAX_SUBJECT)
                        .setRequired(true),
                ),
            new LabelBuilder()
                .setLabel('Feedback type')
                .setRadioGroupComponent(
                    new RadioGroupBuilder()
                        .setCustomId('kind')
                        .setRequired(true)
                        .addOptions(
                            { label: 'Bug report', value: 'bug' },
                            { label: 'Feature idea', value: 'idea' },
                            { label: 'Other feedback', value: 'other' },
                        ),
                ),
            new LabelBuilder()
                .setLabel('Details')
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId('message')
                        .setStyle(TextInputStyle.Paragraph)
                        .setMaxLength(MAX_MESSAGE)
                        .setRequired(true),
                ),
            new LabelBuilder()
                .setLabel('Screenshot or file (optional)')
                .setFileUploadComponent(
                    new FileUploadBuilder().setCustomId('attachment').setMaxValues(1).setRequired(false),
                ),
            new LabelBuilder()
                .setLabel('The team may contact me about this report')
                .setCheckboxComponent(new CheckboxBuilder().setCustomId('contact').setDefault(false)),
        );
}

module.exports = { MODAL_ID, feedbackForm };
