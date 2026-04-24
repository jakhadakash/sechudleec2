"""
Lambda function to stop EC2 instance on EventBridge schedule.
This function is triggered by EventBridge rules to automatically stop the GitLab EC2 instance.
Executes graceful shutdown script via SSM before stopping.
"""
import json
import os
import time
import boto3

ec2 = boto3.client('ec2')
ssm = boto3.client('ssm')

def lambda_handler(event, context):
    """
    Stop the configured EC2 instance with graceful shutdown.
    
    Environment Variables:
        EC2_INSTANCE_ID: The instance ID to stop
        GRACEFUL_SHUTDOWN_SCRIPT: Path to shutdown script on instance (optional)
    
    Returns:
        dict: Response with status code and message
    """
    instance_id = os.environ.get('EC2_INSTANCE_ID')
    shutdown_script = os.environ.get('GRACEFUL_SHUTDOWN_SCRIPT', 
                                     'bash /opt/gitlab/scripts/graceful_shutdown.sh')
    
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
        if tags.get('no-auto-stop') == 'true':
            print(f"Instance {instance_id} has no-auto-stop tag, skipping stop")
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Stop skipped due to no-auto-stop tag',
                    'instance_id': instance_id,
                    'state': current_state
                })
            }
        
        # Only stop if running
        if current_state == 'running':
            print(f"Executing graceful shutdown for instance {instance_id}")
            
            # Execute graceful shutdown script via SSM
            try:
                ssm_response = ssm.send_command(
                    InstanceIds=[instance_id],
                    DocumentName='AWS-RunShellScript',
                    Parameters={'commands': [shutdown_script]},
                    TimeoutSeconds=300
                )
                command_id = ssm_response['Command']['CommandId']
                print(f"SSM command {command_id} sent, waiting 10 seconds for graceful shutdown")
                
                # Wait briefly for graceful shutdown to complete
                time.sleep(10)
                
            except Exception as ssm_error:
                print(f"SSM graceful shutdown failed: {str(ssm_error)}, proceeding with stop anyway")
            
            # Stop the instance
            print(f"Stopping instance {instance_id}")
            ec2.stop_instances(InstanceIds=[instance_id])
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Instance stop initiated with graceful shutdown',
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
        print(f"Error stopping instance {instance_id}: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'instance_id': instance_id
            })
        }
