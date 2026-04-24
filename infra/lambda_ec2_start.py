"""
Lambda function to start EC2 instance on EventBridge schedule.
This function is triggered by EventBridge rules to automatically start the GitLab EC2 instance.
"""
import json
import os
import boto3

ec2 = boto3.client('ec2')

def lambda_handler(event, context):
    """
    Start the configured EC2 instance.
    
    Environment Variables:
        EC2_INSTANCE_ID: The instance ID to start
    
    Returns:
        dict: Response with status code and message
    """
    instance_id = os.environ.get('EC2_INSTANCE_ID')
    
    if not instance_id:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'EC2_INSTANCE_ID environment variable not set'})
        }
    
    try:
        # Check current state
        response = ec2.describe_instances(InstanceIds=[instance_id])
        instance = response['Reservations'][0]['Instances'][0]
        current_state = instance['State']['Name']
        
        # Check for manual override tag
        tags = {tag['Key']: tag['Value'] for tag in instance.get('Tags', [])}
        if tags.get('no-auto-start') == 'true':
            print(f"Instance {instance_id} has no-auto-start tag, skipping start")
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Start skipped due to no-auto-start tag',
                    'instance_id': instance_id,
                    'state': current_state
                })
            }
        
        # Only start if stopped
        if current_state == 'stopped':
            print(f"Starting instance {instance_id}")
            ec2.start_instances(InstanceIds=[instance_id])
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Instance start initiated',
                    'instance_id': instance_id,
                    'previous_state': current_state
                })
            }
        else:
            print(f"Instance {instance_id} is already {current_state}, no action needed")
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': f'Instance already {current_state}',
                    'instance_id': instance_id,
                    'state': current_state
                })
            }
            
    except Exception as e:
        print(f"Error starting instance {instance_id}: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'instance_id': instance_id
            })
        }
