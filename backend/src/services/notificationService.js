const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

// Region/credentials are picked up automatically from the EC2 instance's
// IAM role — no access keys are hardcoded here.
const sns = new SNSClient({ region: process.env.AWS_REGION || 'ap-south-1' });

async function publishBookingConfirmation(booking, slot) {
  const message = [
    `Booking confirmed for slot ${slot.slot_number} (${slot.location}).`,
    `Guest: ${booking.user_name} <${booking.user_email}>`,
    `From: ${booking.start_time}`,
    `To:   ${booking.end_time}`,
    `Total price: ${booking.total_price}`,
    `Booking ID: ${booking.id}`,
  ].join('\n');

  const command = new PublishCommand({
    TopicArn: process.env.SNS_TOPIC_ARN,
    Subject: 'Parking Slot Booking Confirmation',
    Message: message,
  });

  return sns.send(command);
}

module.exports = { publishBookingConfirmation };
